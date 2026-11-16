import type { FastifyPluginAsync } from 'fastify'
import type { CaseComment, CaseState, SupportCase } from '@beverly-call/shared'
import { CASE_SLA_MINUTES, addCommentSchema, assignCaseSchema, createCaseSchema, resolveCaseSchema } from '@beverly-call/shared'
import type { AppDeps } from '../app.js'
import { requireRole } from '../auth/guards.js'
import { auditAs } from '../audit/audit-request.js'
import { staffNames } from '../beverly/staff-directory.js'
import { africasTalking } from '../telephony/provider.js'
import { resolvedSms, sendLoggedSms } from '../notify/sms.js'
import { notify, webPushSender } from '../notify/notify.js'

interface TicketRow {
  id: string; ticket_ref: string; category: string; agent_crm_id: string | null; sla_due_at: Date; status: string
  customer_ref: string; amount_ngn: string | null; customer_phone: string | null; sms_on_resolve: boolean; sms_rating: boolean
}
interface CommentRow { ticket_id: string; author_name: string; body: string; created_at: Date }

const COLS = 'id, ticket_ref, category, agent_crm_id, sla_due_at, status, customer_ref, amount_ngn, customer_phone, sms_on_resolve, sms_rating'

const stateOf = (status: string, due: Date): CaseState =>
  status === 'RESOLVED' || status === 'CLOSED' ? 'Done' : due.getTime() < Date.now() ? 'Overdue' : status === 'INVESTIGATING' ? 'Working' : 'New'

const toComment = (c: CommentRow): CaseComment => ({ by: c.author_name, text: c.body, at: c.created_at.toISOString().slice(11, 16) })

const toCase = (r: TicketRow, comments: CommentRow[], names: Map<string, string>): SupportCase => ({
  id: r.ticket_ref, issue: r.category.replaceAll('_', ' '),
  by: r.agent_crm_id ? names.get(r.agent_crm_id) ?? r.agent_crm_id : 'Unassigned', agentId: r.agent_crm_id,
  slaMinutes: Math.round((r.sla_due_at.getTime() - Date.now()) / 60000), state: stateOf(r.status, r.sla_due_at),
  customer: r.customer_ref, amount: Number(r.amount_ngn ?? 0), comments: comments.filter((c) => c.ticket_id === r.id).map(toComment),
})

/** Escalation tickets (Tier 2). Agents create and comment; supervisors see all, assign and close. */
export const caseRoutes = ({ env, pool, fetchImpl, provider, push }: AppDeps): FastifyPluginAsync => async (app) => {
  const staff = requireRole('agent', 'supervisor', 'admin')
  const lead = requireRole('supervisor', 'admin')
  const carrier = provider ?? africasTalking(env, fetchImpl)
  const send = push === undefined ? webPushSender(env) : push

  async function load(rows: TicketRow[], token: string): Promise<SupportCase[]> {
    if (!rows.length) return []
    const [c, names] = await Promise.all([
      pool.query<CommentRow>('select ticket_id, author_name, body, created_at from call_centre.ticket_comments where ticket_id = any($1::uuid[]) order by created_at', [rows.map((r) => r.id)]),
      staffNames(env, token, fetchImpl),
    ])
    return rows.map((r) => toCase(r, c.rows, names))
  }
  const one = async (ref: string): Promise<TicketRow | undefined> =>
    (await pool.query<TicketRow>(`select ${COLS} from call_centre.tickets where ticket_ref = $1`, [ref])).rows[0]

  app.get('/cases', { preHandler: lead }, async (req) => {
    const r = await pool.query<TicketRow>(`select ${COLS} from call_centre.tickets order by (status in ('RESOLVED','CLOSED')), sla_due_at asc limit 200`)
    return load(r.rows, req.session!.beverlyToken)
  })

  /** Agents see only the cases they raised or hold. */
  app.get('/cases/mine', { preHandler: staff }, async (req) => {
    const r = await pool.query<TicketRow>(`select ${COLS} from call_centre.tickets where agent_crm_id = $1 order by sla_due_at asc limit 100`, [req.session!.user.id])
    return load(r.rows, req.session!.beverlyToken)
  })

  app.post('/cases', { preHandler: staff }, async (req, reply) => {
    const body = createCaseSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid case' })
    const me = req.session!.user
    const d = body.data
    const minutes = CASE_SLA_MINUTES[d.category]
    const r = await pool.query<TicketRow>(
      `insert into call_centre.tickets (ticket_ref, call_id, customer_ref, meter_number, category, priority, agent_crm_id, notes, sla_minutes, sla_due_at, amount_ngn, customer_phone)
       values ('EX-' || nextval('call_centre.ticket_ref_seq'), $1,$2,$3,$4,$5,$6,$7,$8, now() + make_interval(mins => $8::int), $9, $10) returning ${COLS}`,
      [d.callId ?? null, d.customerRef, d.meterNumber ?? null, d.category, d.priority, me.id, d.notes ?? null, minutes, d.amountNgn, d.customerPhone ?? null])
    const row = r.rows[0]!
    if (d.callId) await pool.query(`update call_centre.calls set disposition = coalesce(disposition, 'escalated') where id = $1 and agent_crm_id = $2`, [d.callId, me.id])
    await auditAs(pool, req, 'case.create', 'ticket', row.ticket_ref, { category: d.category })
    await notify(pool, send, { category: 'esc', tone: d.priority === 'CRITICAL' || d.priority === 'HIGH' ? 'bad' : 'ye', title: `${row.ticket_ref} escalated`, body: d.category.replaceAll('_', ' '), link: '/cases', dedupeKey: `new:${row.ticket_ref}` })
    return reply.code(201).send((await load([row], req.session!.beverlyToken))[0])
  })

  app.post<{ Params: { id: string } }>('/cases/:id/assign', { preHandler: lead }, async (req, reply) => {
    const body = assignCaseSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid assignee' })
    const r = await pool.query<TicketRow>(
      `update call_centre.tickets set agent_crm_id = $2, status = case when status = 'OPEN' then 'INVESTIGATING' else status end
       where ticket_ref = $1 and status not in ('RESOLVED','CLOSED') returning ${COLS}`, [req.params.id, body.data.agentId])
    const row = r.rows[0]
    if (!row) return reply.code(404).send({ error: 'Case not found or already closed' })
    await auditAs(pool, req, 'case.assign', 'ticket', row.ticket_ref, { to: body.data.agentId })
    await notify(pool, send, { userId: body.data.agentId, category: 'esc', tone: 'ye', title: `${row.ticket_ref} assigned to you`, body: row.category.replaceAll('_', ' '), link: '/cases' })
    return (await load([row], req.session!.beverlyToken))[0]
  })

  app.post<{ Params: { id: string } }>('/cases/:id/resolve', { preHandler: staff }, async (req, reply) => {
    const body = resolveCaseSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'A resolution note is required' })
    const me = req.session!.user
    const existing = await one(req.params.id)
    if (existing && me.role === 'agent' && existing.agent_crm_id !== me.id) return reply.code(403).send({ error: 'This case is not yours' })
    const r = await pool.query<TicketRow>(
      `update call_centre.tickets set status='RESOLVED', resolution_note=$2, resolved_at=now()
       where ticket_ref=$1 and status not in ('RESOLVED','CLOSED') returning ${COLS}`, [req.params.id, body.data.note])
    const row = r.rows[0]
    if (!row) return reply.code(404).send({ error: 'Case not found or already closed' })
    await pool.query('insert into call_centre.ticket_comments (ticket_id, author_crm_id, author_name, body) values ($1,$2,$3,$4)', [row.id, me.id, me.name, `Resolved: ${body.data.note}`])
    if (row.sms_on_resolve && row.customer_phone) await sendLoggedSms(pool, carrier, row.customer_phone, resolvedSms(row.ticket_ref, row.sms_rating), 'case_resolved', me.id)
    await auditAs(pool, req, 'case.resolve', 'ticket', row.ticket_ref)
    return (await load([row], req.session!.beverlyToken))[0]
  })

  app.post<{ Params: { id: string } }>('/cases/:id/comments', { preHandler: staff }, async (req, reply) => {
    const body = addCommentSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'A comment is required (max 1000 characters)' })
    const me = req.session!.user
    const row = await one(req.params.id)
    if (!row) return reply.code(404).send({ error: 'Case not found' })
    if (me.role === 'agent' && row.agent_crm_id !== me.id) return reply.code(403).send({ error: 'This case is not yours' })
    await pool.query('insert into call_centre.ticket_comments (ticket_id, author_crm_id, author_name, body) values ($1,$2,$3,$4)', [row.id, me.id, me.name, body.data.text])
    await auditAs(pool, req, 'case.comment', 'ticket', row.ticket_ref)
    return (await load([row], req.session!.beverlyToken))[0]
  })
}
