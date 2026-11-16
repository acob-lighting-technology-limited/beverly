import type { FastifyPluginAsync } from 'fastify'
import { coachSchema, monitorSchema, qaSchema, type CoachingEntry, type QaSample } from '@beverly-call/shared'
import type { AppDeps } from '../app.js'
import { requireRole } from '../auth/guards.js'
import { auditAs } from '../audit/audit-request.js'
import { notify, webPushSender } from '../notify/notify.js'

const LABEL: Record<string, string> = { listen: 'Listened in', whisper: 'Whispered to', barge: 'Barged in on' }

/** Supervisor tools: coaching prompts, monitoring sessions (listen, whisper, barge) and QA scoring. */
export const supervisionRoutes = ({ env, pool, push }: AppDeps): FastifyPluginAsync => async (app) => {
  const lead = requireRole('supervisor', 'admin')
  const agent = requireRole('agent', 'supervisor')
  const send = push === undefined ? webPushSender(env) : push

  app.get('/coaching', { preHandler: lead }, async (): Promise<CoachingEntry[]> => {
    const r = await pool.query<{ created_at: Date; kind: string; body: string | null; agent_crm_id: string }>(
      'select created_at, kind, body, agent_crm_id from call_centre.coaching_log order by created_at desc limit 20')
    return r.rows.map((x) => ({ at: x.created_at.toISOString(), agentId: x.agent_crm_id, text: x.kind === 'prompt' ? `Prompt: ${x.body ?? ''}` : `${LABEL[x.kind] ?? x.kind} ${x.agent_crm_id}` }))
  })

  app.post('/coaching', { preHandler: lead }, async (req, reply) => {
    const body = coachSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Choose an agent and type a prompt (max 300 characters)' })
    const me = req.session!.user
    await pool.query(`insert into call_centre.coaching_log (agent_crm_id, supervisor_crm_id, supervisor_name, kind, body) values ($1,$2,$3,'prompt',$4)`, [body.data.agentId, me.id, me.name, body.data.text])
    await notify(pool, send, { userId: body.data.agentId, category: 'sys', tone: 'vi', title: `Coaching from ${me.name}`, body: body.data.text, link: '/call' })
    await auditAs(pool, req, 'coaching.prompt', 'agent', body.data.agentId)
    return reply.code(204).send()
  })

  /** What the agent's own screen shows: prompts sent to them, marked delivered on read. */
  app.get('/coaching/inbox', { preHandler: agent }, async (req) => {
    const r = await pool.query<{ id: string; supervisor_name: string; body: string; created_at: Date }>(
      `update call_centre.coaching_log set delivered_at = now() where agent_crm_id = $1 and kind = 'prompt' and delivered_at is null
       returning id, supervisor_name, body, created_at`, [req.session!.user.id])
    return r.rows.map((x) => ({ id: x.id, from: x.supervisor_name, text: x.body, at: x.created_at.toISOString() }))
  })

  /**
   * Starts or ends a monitoring session on an agent's live call. The session and its audit entry are recorded here.
   * TODO(debt): the media bridge (listen/whisper/barge) needs the carrier's conferencing API wired in; until then this is the audit and consent record.
   */
  app.post('/monitor', { preHandler: lead }, async (req, reply) => {
    const body = monitorSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid monitor request' })
    const call = await pool.query<{ id: string }>('select id from call_centre.calls where agent_crm_id = $1 and ended_at is null order by started_at desc limit 1', [body.data.agentId])
    if (body.data.mode !== 'end' && !call.rows[0]) return reply.code(409).send({ error: 'That agent is not on a call' })
    const me = req.session!.user
    if (body.data.mode !== 'end') await pool.query(`insert into call_centre.coaching_log (agent_crm_id, supervisor_crm_id, supervisor_name, kind) values ($1,$2,$3,$4)`, [body.data.agentId, me.id, me.name, body.data.mode])
    await auditAs(pool, req, `monitor.${body.data.mode}`, 'agent', body.data.agentId, { callId: call.rows[0]?.id ?? null })
    return { callId: call.rows[0]?.id ?? null }
  })

  app.get('/qa/sample', { preHandler: lead }, async (): Promise<QaSample> => {
    const r = await pool.query<{ id: string; started_at: Date; agent_crm_id: string | null; score: number | null }>(
      `select c.id, c.started_at, c.agent_crm_id, q.score from call_centre.calls c left join call_centre.qa_scores q on q.call_id = c.id
       where c.agent_crm_id is not null and c.ended_at is not null order by q.score is not null, c.started_at desc limit 10`)
    return r.rows.map((x) => ({ callId: x.id, at: x.started_at.toISOString(), agentId: x.agent_crm_id ?? '', score: x.score }))
  })

  app.post<{ Params: { callId: string } }>('/qa/:callId', { preHandler: lead }, async (req, reply) => {
    const body = qaSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Score must be 0 to 100' })
    const me = req.session!.user
    const call = await pool.query<{ agent_crm_id: string | null }>('select agent_crm_id from call_centre.calls where id = $1', [req.params.callId])
    if (!call.rows[0]) return reply.code(404).send({ error: 'Call not found' })
    await pool.query(
      `insert into call_centre.qa_scores (call_id, reviewer_crm_id, reviewer_name, score, notes) values ($1,$2,$3,$4,$5)
       on conflict (call_id) do update set score = excluded.score, notes = excluded.notes, reviewer_crm_id = excluded.reviewer_crm_id, reviewer_name = excluded.reviewer_name`,
      [req.params.callId, me.id, me.name, body.data.score, body.data.notes])
    const agentId = call.rows[0].agent_crm_id
    if (agentId) await notify(pool, send, { userId: agentId, category: 'sys', tone: body.data.score >= 80 ? 'ok' : 'ye', title: `Supervisor scored your call ${body.data.score}`, body: body.data.notes, link: '/call' })
    await auditAs(pool, req, 'qa.score', 'call', req.params.callId, { score: body.data.score })
    return reply.code(204).send()
  })
}
