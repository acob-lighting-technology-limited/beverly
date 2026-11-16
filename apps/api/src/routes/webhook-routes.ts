import type { FastifyPluginAsync } from 'fastify'
import type { AppDeps } from '../app.js'
import { parseCallEvent, parseRating, parseSmsEvent, secretMatches, type CallEvent } from '../telephony/africastalking.js'
import { LANGUAGE_DIGITS, dialAgent, emptyResponse, languageMenu, noAgentCallback } from '../routing/ivr.js'
import { pickAgent, type Candidate } from '../routing/pick-agent.js'
import { notify, webPushSender } from '../notify/notify.js'

interface CallRow { id: string; queue: string; agent_crm_id: string | null; language: string }
interface PresenceRow { agent_crm_id: string; client_name: string; status: string; languages: string[]; skills: string[]; idle_since: Date; last_seen: Date }

/**
 * Carrier webhooks. No browser session here: the shared secret authenticates the caller, and the route is exempt
 * from the browser Origin check. Handles IVR, routing, call end, recordings and customer rating replies.
 */
export const webhookRoutes = ({ env, pool, push }: AppDeps): FastifyPluginAsync => async (app) => {
  const send = push === undefined ? webPushSender(env) : push
  const secretOf = (req: { headers: Record<string, unknown>; query: unknown }): string | undefined =>
    (req.headers['x-webhook-secret'] as string | undefined) ?? (req.query as { secret?: string }).secret
  const xml = (reply: { type(t: string): { send(b: string): unknown } }, body: string) => reply.type('text/xml').send(body)
  const menuUrl = () => `${env.API_PUBLIC_URL ?? ''}/api/webhooks/at/voice?secret=${encodeURIComponent(env.AT_WEBHOOK_SECRET ?? '')}`

  async function route(ev: CallEvent, call: CallRow): Promise<string> {
    const lang = ev.dtmfDigits ? LANGUAGE_DIGITS[ev.dtmfDigits.trim()] : undefined
    if (call.queue === 'ivr' && !lang) return languageMenu(menuUrl())
    if (lang && call.queue === 'ivr') await pool.query(`update call_centre.calls set language = $2, queue = 'general' where id = $1`, [call.id, lang])
    if (call.agent_crm_id) return emptyResponse()           // already routed: duplicate event
    const language = (lang ?? call.language) as 'en' | 'ha' | 'yo' | 'ig' | 'pcm'

    const p = await pool.query<PresenceRow>('select agent_crm_id, client_name, status, languages, skills, idle_since, last_seen from call_centre.agent_presence')
    const cands: Candidate[] = p.rows.map((x) => ({ agentId: x.agent_crm_id, clientName: x.client_name, status: x.status, languages: x.languages, skills: x.skills, idleSinceMs: x.idle_since.getTime(), lastSeenMs: x.last_seen.getTime() }))
    const agent = pickAgent(cands, language, Date.now())

    if (!agent) {
      await pool.query(
        `insert into call_centre.callbacks (callback_ref, call_id, phone_number, language, reason)
         values ('CB-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)), $1, $2, $3, 'No agent available')`, [call.id, ev.callerNumber, language])
      await pool.query(`update call_centre.calls set disposition = 'no_agent', ended_at = now() where id = $1`, [call.id])
      await notify(pool, send, { category: 'cb', tone: 'ye', title: 'Callback created: no agent was free', body: ev.callerNumber, link: '/cb' })
      return noAgentCallback()
    }
    // Claim the agent atomically: only succeeds if they are still available.
    const claim = await pool.query(`update call_centre.agent_presence set status = 'busy' where agent_crm_id = $1 and status = 'available'`, [agent.agentId])
    if (!claim.rowCount) return route(ev, { ...call, agent_crm_id: null })
    await pool.query('update call_centre.calls set agent_crm_id = $2, answered_at = now() where id = $1', [call.id, agent.agentId])
    await notify(pool, send, { userId: agent.agentId, category: 'sys', tone: 'ok', title: 'Incoming call', body: ev.callerNumber, link: '/call' })
    return dialAgent(agent.clientName, env.AT_VIRTUAL_NUMBER)
  }

  app.post('/webhooks/at/voice', { config: { rateLimit: { max: 300, timeWindow: '1 minute' } } }, async (req, reply) => {
    if (!secretMatches(secretOf(req), env.AT_WEBHOOK_SECRET)) return reply.code(401).send({ error: 'Unauthorised' })
    const ev = parseCallEvent(req.body)
    if (!ev) return reply.code(400).send({ error: 'Invalid event' })
    await pool.query(`insert into call_centre.webhook_heartbeat (provider, last_seen) values ('africastalking', now())
                      on conflict (provider) do update set last_seen = now()`)

    await pool.query(
      `insert into call_centre.calls (at_session_id, direction, caller_number, queue) values ($1,$2,$3,'ivr') on conflict (at_session_id) do nothing`,
      [ev.sessionId, ev.direction, ev.callerNumber])
    const c = await pool.query<CallRow>('select id, queue, agent_crm_id, language from call_centre.calls where at_session_id = $1', [ev.sessionId])
    const call = c.rows[0]
    if (!call) return reply.code(500).send({ error: 'Call not recorded' })

    if (ev.active) return xml(reply, await route(ev, call))

    // Call finished.
    await pool.query('update call_centre.calls set ended_at = coalesce(ended_at, now()), cost_ngn = coalesce($2, cost_ngn) where id = $1', [call.id, ev.costNgn ?? null])
    if (call.agent_crm_id) await pool.query(`update call_centre.agent_presence set status = 'acw' where agent_crm_id = $1 and status = 'busy'`, [call.agent_crm_id])
    if (ev.recordingUrl) {
      await pool.query(
        `insert into call_centre.recordings (call_id, storage_key, storage_bucket, duration_seconds, expires_at, source_url)
         select $1,$2,'call-recordings',$3, now() + ($4 || ' days')::interval, $5
         where not exists (select 1 from call_centre.recordings where call_id = $1)`,
        [call.id, `calls/${ev.sessionId}.mp3`, ev.durationSeconds, env.RECORDING_RETENTION_DAYS, ev.recordingUrl])
    }
    return xml(reply, emptyResponse())
  })

  /** Customer replies to the rating SMS with 1 to 5; the rating lands on the call behind the most recent resolved case. */
  app.post('/webhooks/at/sms', async (req, reply) => {
    if (!secretMatches(secretOf(req), env.AT_WEBHOOK_SECRET)) return reply.code(401).send({ error: 'Unauthorised' })
    const ev = parseSmsEvent(req.body)
    if (!ev) return reply.code(400).send({ error: 'Invalid event' })
    const rating = parseRating(ev.text)
    if (rating === null) return reply.code(204).send()
    const tail = ev.from.replace(/\D/g, '').slice(-9)
    await pool.query(
      `update call_centre.calls set rating = $2 where id = (
         select call_id from call_centre.tickets
         where call_id is not null and status in ('RESOLVED','CLOSED') and sms_rating
           and right(regexp_replace(coalesce(customer_phone,''), '\\D', '', 'g'), 9) = $1 and resolved_at > now() - interval '7 days'
         order by resolved_at desc limit 1)`, [tail, rating])
    return reply.code(204).send()
  })
}
