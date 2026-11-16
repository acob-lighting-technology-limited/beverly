import type { FastifyPluginAsync } from 'fastify'
import { setPresenceSchema, type LanguageCode, type PresenceRow, type PresenceStatus } from '@beverly-call/shared'
import type { AppDeps } from '../app.js'
import { requireRole } from '../auth/guards.js'
import { PRESENCE_TTL_MS } from '../routing/pick-agent.js'

interface PresenceDbRow { agent_crm_id: string; name: string; status: PresenceStatus; languages: LanguageCode[]; idle_since: Date; last_seen: Date }

/** Safe carrier client name for the agent's browser softphone (letters, digits, dot, dash, underscore). */
export const clientNameFor = (agentId: string): string => `cc.${agentId.replace(/[^\w.-]/g, '').slice(0, 48)}`

/** Agent availability. The browser heartbeats this every ~30 s; a row not seen for 90 s counts as offline. */
export const presenceRoutes = ({ pool }: AppDeps): FastifyPluginAsync => async (app) => {
  const agent = requireRole('agent', 'supervisor')

  app.put('/presence', { preHandler: agent }, async (req, reply) => {
    const body = setPresenceSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid presence' })
    const me = req.session!.user
    await pool.query(
      `insert into call_centre.agent_presence (agent_crm_id, name, client_name, status, languages, idle_since, last_seen)
       values ($1,$2,$3,$4,$5::text[], now(), now())
       on conflict (agent_crm_id) do update set
         name = excluded.name, client_name = excluded.client_name, languages = excluded.languages, last_seen = now(),
         idle_since = case when call_centre.agent_presence.status <> 'available' and excluded.status = 'available' then now() else call_centre.agent_presence.idle_since end,
         -- an agent on a live call stays busy until wrap-up, whatever the browser reports
         status = case when call_centre.agent_presence.status in ('busy','acw') and excluded.status = 'available' then call_centre.agent_presence.status else excluded.status end`,
      [me.id, me.name, body.data.clientName ?? clientNameFor(me.id), body.data.status, body.data.languages])
    return reply.code(204).send()
  })

  app.delete('/presence', { preHandler: agent }, async (req, reply) => {
    await pool.query('delete from call_centre.agent_presence where agent_crm_id = $1', [req.session!.user.id])
    return reply.code(204).send()
  })

  /** Colleagues who can take a transfer right now (available and seen recently). Agents may not see the full roster. */
  app.get('/presence/available', { preHandler: agent }, async (req) => {
    const r = await pool.query<{ agent_crm_id: string; name: string; languages: LanguageCode[] }>(
      `select agent_crm_id, name, languages from call_centre.agent_presence
       where status = 'available' and agent_crm_id <> $1 and last_seen > now() - interval '90 seconds' order by idle_since`, [req.session!.user.id])
    return r.rows.map((x) => ({ agentId: x.agent_crm_id, name: x.name, languages: x.languages }))
  })

  app.get('/presence', { preHandler: requireRole('supervisor', 'admin') }, async (): Promise<PresenceRow[]> => {
    const r = await pool.query<PresenceDbRow>('select agent_crm_id, name, status, languages, idle_since, last_seen from call_centre.agent_presence order by name')
    const now = Date.now()
    return r.rows.map((x) => ({
      agentId: x.agent_crm_id, name: x.name, status: x.status, languages: x.languages,
      sinceSeconds: Math.max(0, Math.round((now - x.idle_since.getTime()) / 1000)), online: now - x.last_seen.getTime() <= PRESENCE_TTL_MS,
    }))
  })
}
