import type { FastifyPluginAsync } from 'fastify'
import { createCallbackSchema, rescheduleSchema, type CallbackFull } from '@beverly-call/shared'
import type { AppDeps } from '../app.js'
import { requireRole } from '../auth/guards.js'
import { auditAs } from '../audit/audit-request.js'
import { africasTalking, ProviderUnavailable } from '../telephony/provider.js'

interface CallbackRow { callback_ref: string; phone_number: string; language: string; scheduled_for: Date; reason: string | null; attempts: number; status: string }

const LANG: Record<string, string> = { en: 'English', ha: 'Hausa', yo: 'Yoruba', ig: 'Igbo', pcm: 'Pidgin' }
const statusOf = (due: Date): CallbackFull['status'] => {
  const mins = (due.getTime() - Date.now()) / 60000
  return mins < 0 ? 'Overdue' : mins < 60 ? 'Due' : 'Later'
}
const toCallback = (r: CallbackRow): CallbackFull => ({
  id: r.callback_ref, time: r.scheduled_for.toISOString().slice(11, 16), name: r.phone_number, phone: r.phone_number,
  language: LANG[r.language] ?? r.language, status: statusOf(r.scheduled_for), reason: r.reason, attempts: r.attempts, scheduledFor: r.scheduled_for.toISOString(),
})
const COLS = 'callback_ref, phone_number, language, scheduled_for, reason, attempts, status'

/** Callback queue: list, create, reschedule, dial (carrier call to the customer) and complete. */
export const callbackRoutes = ({ env, pool, fetchImpl, provider }: AppDeps): FastifyPluginAsync => async (app) => {
  const staff = requireRole('agent', 'supervisor')
  const carrier = provider ?? africasTalking(env, fetchImpl)

  app.get('/callbacks', { preHandler: staff }, async (req): Promise<CallbackFull[]> => {
    // Agents see their own plus unassigned work; supervisors see everything.
    const r = await pool.query<CallbackRow>(
      `select ${COLS} from call_centre.callbacks
       where status in ('pending','assigned') and ($2 or assigned_to_crm_id is null or assigned_to_crm_id = $1)
       order by scheduled_for asc limit 200`, [req.session!.user.id, req.session!.user.role !== 'agent'])
    return r.rows.map(toCallback)
  })

  /** Month calendar data: callbacks on each day of the month. */
  app.get<{ Querystring: { month?: string } }>('/callbacks/calendar', { preHandler: staff }, async (req, reply) => {
    const m = /^\d{4}-\d{2}$/.exec(req.query.month ?? new Date().toISOString().slice(0, 7))
    if (!m) return reply.code(400).send({ error: 'month must be YYYY-MM' })
    const r = await pool.query<{ day: number; status: string; n: string }>(
      `select extract(day from scheduled_for)::int as day, status, count(*) n from call_centre.callbacks
       where to_char(scheduled_for, 'YYYY-MM') = $1 group by 1, 2 order by 1`, [m[0]])
    return r.rows.map((x) => ({ day: x.day, status: x.status, count: Number(x.n) }))
  })

  app.post('/callbacks', { preHandler: staff }, async (req, reply) => {
    const body = createCallbackSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid callback' })
    const me = req.session!.user
    const d = body.data
    const r = await pool.query<CallbackRow>(
      `insert into call_centre.callbacks (callback_ref, phone_number, customer_ref, language, reason, assigned_to_crm_id, scheduled_for)
       values ('CB-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)), $1,$2,$3,$4,$5, now() + ($6 || ' minutes')::interval) returning ${COLS}`,
      [d.phone, d.customerRef ?? null, d.language, d.reason ?? null, me.id, d.minutes])
    await auditAs(pool, req, 'callback.create', 'callback', r.rows[0]!.callback_ref)
    return reply.code(201).send(toCallback(r.rows[0]!))
  })

  app.post<{ Params: { id: string } }>('/callbacks/:id/reschedule', { preHandler: staff }, async (req, reply) => {
    const body = rescheduleSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid reschedule' })
    const d = body.data
    const r = await pool.query<CallbackRow>(
      d.minutes === 1440
        ? `update call_centre.callbacks set scheduled_for = date_trunc('day', now()) + interval '1 day 9 hours', last_outcome = $2, note = $3, status = 'pending'
           where callback_ref = $1 and status in ('pending','assigned') returning ${COLS}`
        : `update call_centre.callbacks set scheduled_for = greatest(scheduled_for, now()) + ($4 || ' minutes')::interval, last_outcome = $2, note = $3, status = 'pending'
           where callback_ref = $1 and status in ('pending','assigned') returning ${COLS}`,
      d.minutes === 1440 ? [req.params.id, d.lastOutcome, d.note] : [req.params.id, d.lastOutcome, d.note, d.minutes])
    if (!r.rows[0]) return reply.code(404).send({ error: 'Callback not found' })
    await auditAs(pool, req, 'callback.reschedule', 'callback', req.params.id, { outcome: d.lastOutcome, minutes: d.minutes })
    return toCallback(r.rows[0])
  })

  /** Dials the customer through the carrier. The attempt is counted and the callback assigned to the caller. */
  app.post<{ Params: { id: string } }>('/callbacks/:id/start', { preHandler: staff }, async (req, reply) => {
    const me = req.session!.user
    const cb = await pool.query<{ phone_number: string }>(
      `update call_centre.callbacks set status='assigned', assigned_to_crm_id=$2, attempts=attempts+1
       where callback_ref=$1 and status in ('pending','assigned') returning phone_number`, [req.params.id, me.id])
    const row = cb.rows[0]
    if (!row) return reply.code(404).send({ error: 'Callback not found' })
    let dialled = false
    if (carrier.configured && env.AT_VIRTUAL_NUMBER) {
      try { await carrier.makeCall(env.AT_VIRTUAL_NUMBER, row.phone_number); dialled = true }
      catch (e) { if (!(e instanceof ProviderUnavailable)) throw e }
    }
    await auditAs(pool, req, 'callback.start', 'callback', req.params.id, { dialled })
    return reply.code(200).send({ dialled })
  })

  app.post<{ Params: { id: string } }>('/callbacks/:id/complete', { preHandler: staff }, async (req, reply) => {
    const r = await pool.query(
      `update call_centre.callbacks set status='completed', completed_at=now() where callback_ref=$1 and status in ('pending','assigned') returning callback_ref`, [req.params.id])
    if (!r.rowCount) return reply.code(404).send({ error: 'Callback not found' })
    await auditAs(pool, req, 'callback.complete', 'callback', req.params.id)
    return reply.code(204).send()
  })
}
