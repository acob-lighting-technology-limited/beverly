import type { FastifyPluginAsync } from 'fastify'
import { outagesSchema, transferSchema, noteSchema, wrapUpSchema, languageSchema, type ActiveCall, type CallNote } from '@beverly-call/shared'
import type { AppDeps } from '../app.js'
import { requireRole } from '../auth/guards.js'
import { auditAs } from '../audit/audit-request.js'
import { BeverlyError, fetchCustomers, phoneTail } from '../beverly/beverly-api.js'
import { africasTalking, ProviderUnavailable } from '../telephony/provider.js'
import { clientNameFor } from './presence-routes.js'
import { notify, webPushSender } from '../notify/notify.js'

/** +2348035550142 -> 08035550142, the format Beverly stores customer phones in. */
const localNumber = (n: string): string => `0${n.replace(/\D/g, '').slice(-10)}`

interface CallRow { id: string; caller_number: string; started_at: Date; language: string; customer_ref: string | null; meter_number: string | null; customer_name: string | null; agent_crm_id: string | null }

/** Live call state, notes, transfer, wrap-up and the browser softphone token. Only the call's own agent may act on it. */
export const callRoutes = ({ env, pool, fetchImpl, provider, push }: AppDeps): FastifyPluginAsync => async (app) => {
  const agent = requireRole('agent', 'supervisor')
  const carrier = provider ?? africasTalking(env, fetchImpl)
  const send = push === undefined ? webPushSender(env) : push

  const owned = async (callId: string, userId: string): Promise<CallRow | null> => {
    const r = await pool.query<CallRow>(
      'select id, caller_number, started_at, language, customer_ref, meter_number, customer_name, agent_crm_id from call_centre.calls where id = $1 and agent_crm_id = $2', [callId, userId])
    return r.rows[0] ?? null
  }

  app.get('/calls/active', { preHandler: agent }, async (req): Promise<ActiveCall | null> => {
    const me = req.session!.user
    const r = await pool.query<CallRow>(
      `select id, caller_number, started_at, language, customer_ref, meter_number, customer_name, agent_crm_id
       from call_centre.calls where agent_crm_id = $1 and ended_at is null order by started_at desc limit 1`, [me.id])
    const call = r.rows[0]
    if (!call) return null

    // Match the caller to a Beverly customer once, then remember it on the call.
    let area = ''
    let balance: number | null = null
    let customer: ActiveCall['customer'] = null
    if (!call.customer_ref) {
      try {
        const found = (await fetchCustomers(env, req.session!.beverlyToken, localNumber(call.caller_number), fetchImpl, 5)).find((c) => phoneTail(c.phone) === phoneTail(call.caller_number))
        if (found) {
          await pool.query('update call_centre.calls set customer_ref = $2, meter_number = $3, customer_name = $4 where id = $1', [call.id, found.id, found.meter, found.name])
          Object.assign(call, { customer_ref: found.id, meter_number: found.meter, customer_name: found.name })
          area = found.area; balance = found.balance
        }
      } catch (e) { if (!(e instanceof BeverlyError)) throw e }
    }
    if (call.customer_ref && call.customer_name) customer = { id: call.customer_ref, name: call.customer_name, meter: call.meter_number ?? '', balance }

    const tickets = call.customer_ref
      ? await pool.query<{ n: string }>(`select count(*) n from call_centre.tickets where customer_ref = $1 and status in ('OPEN','INVESTIGATING')`, [call.customer_ref])
      : { rows: [{ n: '0' }] }
    const s = await pool.query<{ value: unknown }>(`select value from call_centre.settings where key = 'outages'`)
    const outages = outagesSchema.safeParse(s.rows[0]?.value)
    const hit = outages.success && area ? outages.data.find((o) => area.toLowerCase().includes(o.area.toLowerCase())) : undefined
    return {
      id: call.id, name: call.customer_name ?? call.caller_number, number: call.caller_number, startedAt: call.started_at.toISOString(),
      language: languageSchema.catch('en').parse(call.language), customer, openTickets: Number(tickets.rows[0]?.n ?? 0),
      outage: hit ? `${hit.message} until ${hit.until}` : null,
    }
  })

  app.post<{ Params: { id: string } }>('/calls/:id/wrap-up', { preHandler: agent }, async (req, reply) => {
    const body = wrapUpSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid wrap-up' })
    const me = req.session!.user
    const r = await pool.query(
      `update call_centre.calls set ended_at = coalesce(ended_at, now()), disposition = $3, notes = $4
       where id = $1 and agent_crm_id = $2 and (disposition is null or disposition = 'escalated') returning id, caller_number, language, customer_ref`,
      [req.params.id, me.id, body.data.outcome, body.data.notes])
    const row = r.rows[0] as { caller_number: string; language: string; customer_ref: string | null } | undefined
    if (!row) return reply.code(404).send({ error: 'Call not found' })
    if (body.data.outcome === 'Callback needed') {
      await pool.query(
        `insert into call_centre.callbacks (callback_ref, call_id, phone_number, customer_ref, language, reason, assigned_to_crm_id, scheduled_for)
         values ('CB-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)), $1, $2, $3, $4, $5, $6, now() + interval '30 minutes')`,
        [req.params.id, row.caller_number, row.customer_ref, row.language, body.data.notes || 'Callback requested on the call', me.id])
    }
    await pool.query(`update call_centre.agent_presence set status = 'available', idle_since = now() where agent_crm_id = $1 and status in ('acw','busy')`, [me.id])
    await auditAs(pool, req, 'call.wrap_up', 'call', req.params.id, { outcome: body.data.outcome })
    return reply.code(204).send()
  })

  app.post<{ Params: { id: string } }>('/calls/:id/transfer', { preHandler: agent }, async (req, reply) => {
    const body = transferSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid transfer' })
    const me = req.session!.user
    const call = await owned(req.params.id, me.id)
    if (!call) return reply.code(404).send({ error: 'Call not found' })
    if (body.data.toAgentId === me.id) return reply.code(400).send({ error: 'You cannot transfer to yourself' })
    // The target must be free and the claim is atomic, so two agents cannot receive the same transfer.
    const claim = await pool.query(
      `update call_centre.agent_presence set status = 'busy' where agent_crm_id = $1 and status = 'available' and last_seen > now() - interval '90 seconds' returning name`, [body.data.toAgentId])
    if (!claim.rowCount) return reply.code(409).send({ error: 'That agent is not available' })
    await pool.query('update call_centre.calls set agent_crm_id = $2, transferred_from = $3 where id = $1', [call.id, body.data.toAgentId, me.id])
    await pool.query(`update call_centre.agent_presence set status = 'acw' where agent_crm_id = $1`, [me.id])
    await notify(pool, send, { userId: body.data.toAgentId, category: 'sys', tone: 'ok', title: body.data.warm ? 'Warm transfer: caller is waiting' : 'Call transferred to you', body: call.caller_number, link: '/call' })
    await auditAs(pool, req, 'call.transfer', 'call', call.id, { to: body.data.toAgentId, warm: body.data.warm })
    return reply.code(204).send()
  })

  app.get<{ Params: { id: string } }>('/calls/:id/notes', { preHandler: agent }, async (req, reply): Promise<CallNote[] | void> => {
    if (!(await owned(req.params.id, req.session!.user.id)) && req.session!.user.role === 'agent') return reply.code(404).send({ error: 'Call not found' })
    const r = await pool.query<{ author_name: string; body: string; created_at: Date }>('select author_name, body, created_at from call_centre.call_notes where call_id = $1 order by created_at', [req.params.id])
    return r.rows.map((n) => ({ by: n.author_name, text: n.body, at: n.created_at.toISOString().slice(11, 16) }))
  })

  app.post<{ Params: { id: string } }>('/calls/:id/notes', { preHandler: agent }, async (req, reply) => {
    const body = noteSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'A note is required (max 1000 characters)' })
    const me = req.session!.user
    if (!(await owned(req.params.id, me.id))) return reply.code(404).send({ error: 'Call not found' })
    await pool.query('insert into call_centre.call_notes (call_id, author_crm_id, author_name, body) values ($1,$2,$3,$4)', [req.params.id, me.id, me.name, body.data.text])
    await auditAs(pool, req, 'call.note', 'call', req.params.id)
    return reply.code(204).send()
  })

  /** Draft summary: the call's notes joined with its outcome, ready to paste into a case. */
  app.get<{ Params: { id: string } }>('/calls/:id/summary', { preHandler: agent }, async (req, reply) => {
    const call = await owned(req.params.id, req.session!.user.id)
    if (!call) return reply.code(404).send({ error: 'Call not found' })
    const n = await pool.query<{ body: string }>('select body from call_centre.call_notes where call_id = $1 order by created_at', [call.id])
    return { text: `Summary: ${n.rows.map((x) => x.body).join('. ') || 'No notes taken'}.` }
  })

  /** Short-lived token for the agent's browser softphone (carrier WebRTC client). */
  app.get('/softphone/token', { preHandler: agent }, async (req, reply) => {
    try { return await carrier.webrtcToken(clientNameFor(req.session!.user.id), 3600) }
    catch (e) {
      if (e instanceof ProviderUnavailable) return reply.code(503).send({ error: 'Softphone is unavailable' })
      throw e
    }
  })
}
