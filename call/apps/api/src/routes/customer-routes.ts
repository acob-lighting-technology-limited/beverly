import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import type { Customer, CustomerDetail, CustomerFull, TimelineEvent, WalletInfo } from '@beverly-call/shared'
import { customerSmsSchema, noteSchema, tokenRevealSchema } from '@beverly-call/shared'
import type { AppDeps } from '../app.js'
import { requireRole } from '../auth/guards.js'
import { auditAs } from '../audit/audit-request.js'
import { BeverlyError } from '../beverly/beverly-api.js'
import { beverlyData } from '../beverly/beverly-data.js'
import { maskLast4, maskToken } from '../beverly/token-mask.js'
import { africasTalking } from '../telephony/provider.js'
import { sendLoggedSms } from '../notify/sms.js'

const beverlyFail = (reply: FastifyReply, e: unknown) => {
  if (e instanceof BeverlyError) return reply.code(e.status === 401 || e.status === 403 ? e.status : 502).send({ error: e.message })
  throw e
}

/** Customer lookup, history, notes, SMS and the audited STS token reveal. Beverly data is read-only. */
export const customerRoutes = ({ env, pool, fetchImpl, provider }: AppDeps): FastifyPluginAsync => async (app) => {
  const staff = requireRole('agent', 'supervisor', 'admin')
  const carrier = provider ?? africasTalking(env, fetchImpl)

  app.get<{ Querystring: { q?: string } }>('/customers', { preHandler: staff }, async (req, reply): Promise<Customer[] | void> => {
    const q = (req.query.q ?? '').slice(0, 64)
    try {
      const list = await beverlyData({ env, pool, fetchImpl }, req.session!).customers(q)
      if (q) await auditAs(pool, req, 'customer.search', 'customer', 'search')
      return list
    } catch (e) { return beverlyFail(reply, e) }
  })

  /** Purchases from Beverly (tokens masked here) plus our own cases for the customer. */
  app.get<{ Params: { id: string } }>('/customers/:id/detail', { preHandler: staff }, async (req, reply): Promise<CustomerDetail | void> => {
    try {
      const data = beverlyData({ env, pool, fetchImpl }, req.session!)
      const [list, meters] = await Promise.all([data.purchases(req.params.id), data.meters(req.params.id).catch((e) => { if (e instanceof BeverlyError && e.status === 403) throw e; return [] as string[] })])
      const t = await pool.query<{ ticket_ref: string; category: string; status: string; created_at: Date }>(
        'select ticket_ref, category, status, created_at from call_centre.tickets where customer_ref = $1 order by created_at desc limit 10', [req.params.id])
      await auditAs(pool, req, 'customer.view', 'customer', req.params.id)
      return {
        meters,
        // Beverly stores money in minor units (kobo).
        purchases: list.map((p) => ({ id: String(p.id ?? ''), at: String(p.created_at ?? ''), amount: Number(p.amount_minor ?? 0) / 100, status: String(p.status ?? 'unknown'), tokenMasked: p.token_last4 !== undefined ? maskLast4(p.token_last4) : maskToken(p.token) })),
        tickets: t.rows.map((x) => ({ ref: x.ticket_ref, category: x.category.replaceAll('_', ' '), status: x.status, createdAt: x.created_at.toISOString() })),
      }
    } catch (e) { return beverlyFail(reply, e) }
  })

  /** Wallet balance, holds and available funds for a customer the staff member may see. */
  app.get<{ Params: { id: string } }>('/customers/:id/wallet', { preHandler: staff }, async (req, reply): Promise<WalletInfo | void> => {
    try {
      const w = await beverlyData({ env, pool, fetchImpl }, req.session!).wallet(req.params.id)
      return w ?? (reply.code(404).send({ error: 'No wallet for this customer' }) as unknown as void)
    } catch (e) { return beverlyFail(reply, e) }
  })

  /** Our own view of a customer: notes, one timeline across calls, cases and callbacks, the case funnel and callbacks. */
  app.get<{ Params: { id: string } }>('/customers/:id/full', { preHandler: staff }, async (req): Promise<CustomerFull> => {
    const id = req.params.id
    const [notes, calls, cases, cbs] = await Promise.all([
      pool.query<{ author_name: string; body: string; created_at: Date }>('select author_name, body, created_at from call_centre.customer_notes where customer_ref = $1 order by created_at desc limit 50', [id]),
      pool.query<{ started_at: Date; disposition: string | null }>('select started_at, disposition from call_centre.calls where customer_ref = $1 order by started_at desc limit 20', [id]),
      pool.query<{ ticket_ref: string; category: string; status: string; created_at: Date }>('select ticket_ref, category, status, created_at from call_centre.tickets where customer_ref = $1 order by created_at desc limit 50', [id]),
      pool.query<{ callback_ref: string; scheduled_for: Date; status: string }>('select callback_ref, scheduled_for, status from call_centre.callbacks where customer_ref = $1 order by scheduled_for desc limit 20', [id]),
    ])
    const ev: TimelineEvent[] = [
      ...notes.rows.map((n) => ({ at: n.created_at.toISOString(), kind: 'note' as const, text: `${n.author_name}: ${n.body}`, tone: 'vi' as const })),
      ...calls.rows.map((c) => ({ at: c.started_at.toISOString(), kind: 'call' as const, text: `Called us${c.disposition ? `, ${c.disposition.replaceAll('_', ' ')}` : ''}`, tone: 'vi' as const })),
      ...cases.rows.map((t) => ({ at: t.created_at.toISOString(), kind: 'case' as const, text: `${t.ticket_ref} ${t.category.replaceAll('_', ' ')} (${t.status.toLowerCase()})`, tone: t.status === 'RESOLVED' || t.status === 'CLOSED' ? 'ok' as const : 'bad' as const })),
      ...cbs.rows.map((c) => ({ at: c.scheduled_for.toISOString(), kind: 'callback' as const, text: `Callback ${c.status}`, tone: 'ye' as const })),
    ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30)
    const n = (s: string[]) => cases.rows.filter((t) => s.includes(t.status)).length
    const lastContact = [calls.rows[0]?.started_at, notes.rows[0]?.created_at].filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0]
    return {
      notes: notes.rows.map((x) => ({ by: x.author_name, text: x.body, at: x.created_at.toISOString() })), timeline: ev,
      stages: { reported: cases.rows.length, escalated: n(['OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED']), working: n(['INVESTIGATING']), fixed: n(['RESOLVED', 'CLOSED']) },
      callbacks: cbs.rows.map((c) => ({ id: c.callback_ref, scheduledFor: c.scheduled_for.toISOString(), status: c.status })),
      lastContacted: lastContact ? lastContact.toISOString() : null,
    }
  })

  /** Agents may add notes about a customer. They may not edit Beverly's customer record: that stays read-only by design. */
  app.post<{ Params: { id: string } }>('/customers/:id/notes', { preHandler: staff }, async (req, reply) => {
    const body = noteSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'A note is required (max 1000 characters)' })
    const me = req.session!.user
    await pool.query('insert into call_centre.customer_notes (customer_ref, author_crm_id, author_name, body) values ($1,$2,$3,$4)', [req.params.id, me.id, me.name, body.data.text])
    await auditAs(pool, req, 'customer.note', 'customer', req.params.id)
    return reply.code(204).send()
  })

  app.post('/customers/sms', { preHandler: staff, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const body = customerSmsSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid message' })
    const result = await sendLoggedSms(pool, carrier, body.data.phone, body.data.text, 'agent', req.session!.user.id)
    await auditAs(pool, req, 'customer.sms', 'customer', body.data.customerRef ?? 'unknown', { result })
    return reply.code(result === 'failed' ? 502 : 200).send({ result })
  })

  /**
   * Releases the raw STS token. All three verification checks and a reason are required. The reveal is audited BEFORE
   * the token is returned: if the audit write fails the token is not released.
   */
  app.post<{ Params: { id: string } }>('/customers/:id/token-reveal', { preHandler: staff, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const body = tokenRevealSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'All three verification checks and a reason are required' })
    try {
      const token = await beverlyData({ env, pool, fetchImpl }, req.session!).revealToken(req.params.id, body.data.purchaseId)
      if (!token) return reply.code(404).send({ error: 'No token on that purchase' })
      await auditAs(pool, req, 'token.reveal', 'purchase', body.data.purchaseId, { customer: req.params.id, reason: body.data.reason })
      return { token }
    } catch (e) { return beverlyFail(reply, e) }
  })
}
