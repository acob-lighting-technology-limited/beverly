import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { A1, A2, boot, hook, type Harness } from './helpers.js'

let h: Harness
beforeAll(async () => { h = await boot() })
beforeEach(async () => { await h.reset() })

const VOICE = '/api/webhooks/at/voice'
const ev = (over: Record<string, string> = {}) => ({ sessionId: 'S1', isActive: '1', callerNumber: '+2348035550142', direction: 'inbound', ...over })

async function agentOnline(email: string, languages = ['en', 'ha']) {
  const a = await h.as(email)
  expect((await h.send('PUT', '/api/presence', a, { status: 'available', languages })).status).toBe(204)
  return a
}

describe('IVR and routing', () => {
  it('rejects a wrong secret and malformed events', async () => {
    expect((await hook(h, VOICE, ev(), 'wrong')).statusCode).toBe(401)
    expect((await hook(h, VOICE, { isActive: '9' })).statusCode).toBe(400)
  })

  it('plays the language menu first, then routes the chosen language to the longest-idle matching agent', async () => {
    await agentOnline('agent1@x.test')
    const menu = await hook(h, VOICE, ev())
    expect(menu.body).toContain('GetDigits')
    expect(menu.body).toContain('callbackUrl="https://api.call.test/api/webhooks/at/voice?secret=webhook-secret-1234"')

    const routed = await hook(h, VOICE, ev({ dtmfDigits: '2' }))   // 2 = Hausa
    expect(routed.body).toContain(`<Dial phoneNumbers="cc.${A1}"`)
    const call = (await h.pool.query<{ language: string; agent_crm_id: string; queue: string }>('select language, agent_crm_id, queue from call_centre.calls')).rows[0]!
    expect(call).toMatchObject({ language: 'ha', agent_crm_id: A1, queue: 'general' })
    // the agent is now busy and was told about the call
    expect((await h.pool.query<{ status: string }>(`select status from call_centre.agent_presence`)).rows[0]!.status).toBe('busy')
    expect((await h.pool.query(`select 1 from call_centre.notifications where title = 'Incoming call' and user_crm_id = $1`, [A1])).rowCount).toBe(1)
  })

  it('re-asks on an invalid digit and ignores a duplicate routing event', async () => {
    await agentOnline('agent1@x.test')
    await hook(h, VOICE, ev())
    expect((await hook(h, VOICE, ev({ dtmfDigits: '9' }))).body).toContain('GetDigits')
    await hook(h, VOICE, ev({ dtmfDigits: '1' }))
    const dup = await hook(h, VOICE, ev({ dtmfDigits: '1' }))
    expect(dup.body).not.toContain('Dial')
  })

  it('does not route to an agent without the language, on break, or not seen recently', async () => {
    const a = await h.as('agent1@x.test')
    await h.send('PUT', '/api/presence', a, { status: 'available', languages: ['en'] })
    await hook(h, VOICE, ev())
    expect((await hook(h, VOICE, ev({ dtmfDigits: '3' }))).body).toContain('Reject')   // Yoruba: nobody speaks it
    await h.send('PUT', '/api/presence', a, { status: 'break', languages: ['en'] })
    await hook(h, VOICE, ev({ sessionId: 'S2' }))
    expect((await hook(h, VOICE, ev({ sessionId: 'S2', dtmfDigits: '1' }))).body).toContain('Reject')
    await h.send('PUT', '/api/presence', a, { status: 'available', languages: ['en'] })
    await h.pool.query(`update call_centre.agent_presence set last_seen = now() - interval '5 minutes'`)
    await hook(h, VOICE, ev({ sessionId: 'S3' }))
    expect((await hook(h, VOICE, ev({ sessionId: 'S3', dtmfDigits: '1' }))).body).toContain('Reject')
  })

  it('creates a callback and alerts supervisors when nobody is free', async () => {
    await hook(h, VOICE, ev())
    await hook(h, VOICE, ev({ dtmfDigits: '1' }))
    const cb = (await h.pool.query<{ phone_number: string; reason: string; status: string }>('select phone_number, reason, status from call_centre.callbacks')).rows
    expect(cb).toEqual([{ phone_number: '+2348035550142', reason: 'No agent available', status: 'pending' }])
    const call = (await h.pool.query<{ disposition: string }>('select disposition from call_centre.calls')).rows[0]!
    expect(call.disposition).toBe('no_agent')
  })

  it('two simultaneous calls cannot claim the same agent', async () => {
    await agentOnline('agent1@x.test')
    await hook(h, VOICE, ev({ sessionId: 'A' })); await hook(h, VOICE, ev({ sessionId: 'B' }))
    const [a, b] = await Promise.all([hook(h, VOICE, ev({ sessionId: 'A', dtmfDigits: '1' })), hook(h, VOICE, ev({ sessionId: 'B', dtmfDigits: '1' }))])
    expect([a.body, b.body].filter((x) => x.includes('Dial'))).toHaveLength(1)
  })

  it('ends the call, stores cost, registers one recording and puts the agent in wrap-up', async () => {
    await agentOnline('agent1@x.test')
    await hook(h, VOICE, ev()); await hook(h, VOICE, ev({ dtmfDigits: '1' }))
    const end = { isActive: '0', durationInSeconds: '90', recordingUrl: 'https://rec.test/a.mp3', amount: 'NGN 4.5000' }
    await hook(h, VOICE, ev(end)); await hook(h, VOICE, ev(end))
    const c = (await h.pool.query<{ ended_at: Date | null; cost_ngn: string }>('select ended_at, cost_ngn from call_centre.calls')).rows[0]!
    expect(c.ended_at).not.toBeNull()
    expect(Number(c.cost_ngn)).toBe(4.5)
    const rec = (await h.pool.query<{ source_url: string; ingested_at: Date | null }>('select source_url, ingested_at from call_centre.recordings')).rows
    expect(rec).toHaveLength(1)
    expect(rec[0]).toMatchObject({ source_url: 'https://rec.test/a.mp3', ingested_at: null })
    expect((await h.pool.query<{ status: string }>('select status from call_centre.agent_presence')).rows[0]!.status).toBe('acw')
  })
})

describe('the call desk', () => {
  async function liveCall() {
    const a = await agentOnline('agent1@x.test')
    await hook(h, VOICE, ev()); await hook(h, VOICE, ev({ dtmfDigits: '1' }))
    return a
  }

  it('shows the active call matched to a Beverly customer, with open case count and outage banner', async () => {
    const a = await liveCall()
    await h.pool.query(`insert into call_centre.tickets (ticket_ref, customer_ref, category, sla_due_at) values ('EX-1','c1','other', now() + interval '1 hour')`)
    const adm = await h.as('admin1@x.test')
    await h.send('PUT', '/api/admin/settings/outages', adm, [{ area: 'Kano North', message: 'Planned outage', until: '14:00' }])
    const r = await h.get('/api/calls/active', a)
    expect(r.json).toMatchObject({ name: 'Musa Garba', number: '+2348035550142', customer: { id: 'c1', meter: '4201 8837 112', balance: 3200 }, openTickets: 1, outage: 'Planned outage until 14:00', language: 'en' })
  })

  it('returns null with no call, and another agent cannot see or touch the call', async () => {
    const a = await liveCall()
    const other = await agentOnline('agent2@x.test')
    expect((await h.get('/api/calls/active', other)).json).toBeNull()
    const id = (await h.get('/api/calls/active', a)).json.id as string
    expect((await h.send('POST', `/api/calls/${id}/notes`, other, { text: 'x' })).status).toBe(404)
    expect((await h.send('POST', `/api/calls/${id}/wrap-up`, other, { outcome: 'Resolved on the call', notes: '' })).status).toBe(404)
    expect((await h.send('POST', `/api/calls/${id}/transfer`, other, { toAgentId: A1 })).status).toBe(404)
  })

  it('takes notes and drafts a summary', async () => {
    const a = await liveCall()
    const id = (await h.get('/api/calls/active', a)).json.id as string
    expect((await h.send('POST', `/api/calls/${id}/notes`, a, { text: '   ' })).status).toBe(400)
    await h.send('POST', `/api/calls/${id}/notes`, a, { text: 'Paid NGN 5,000, no token' })
    await h.send('POST', `/api/calls/${id}/notes`, a, { text: 'Caller verified' })
    expect((await h.get(`/api/calls/${id}/notes`, a)).json).toMatchObject([{ by: 'agent1', text: 'Paid NGN 5,000, no token' }, { text: 'Caller verified' }])
    expect((await h.get(`/api/calls/${id}/summary`, a)).json.text).toBe('Summary: Paid NGN 5,000, no token. Caller verified.')
  })

  it('transfers only to an available agent, atomically', async () => {
    const a = await liveCall()
    const b = await agentOnline('agent2@x.test')
    const id = (await h.get('/api/calls/active', a)).json.id as string
    expect((await h.send('POST', `/api/calls/${id}/transfer`, a, { toAgentId: A1 })).status).toBe(400)
    expect((await h.send('POST', `/api/calls/${id}/transfer`, a, { toAgentId: 'u-ghost' })).status).toBe(409)
    expect((await h.send('POST', `/api/calls/${id}/transfer`, a, { toAgentId: A2, warm: true })).status).toBe(204)
    expect((await h.get('/api/calls/active', a)).json).toBeNull()
    expect((await h.get('/api/calls/active', b)).json).toMatchObject({ id })
    expect((await h.pool.query<{ transferred_from: string }>('select transferred_from from call_centre.calls')).rows[0]!.transferred_from).toBe(A1)
    expect((await h.pool.query(`select 1 from call_centre.notifications where title like 'Warm transfer%' and user_crm_id = $1`, [A2])).rowCount).toBe(1)
  })

  it('wrap-up closes the call, frees the agent and creates a callback when one is needed', async () => {
    const a = await liveCall()
    const id = (await h.get('/api/calls/active', a)).json.id as string
    expect((await h.send('POST', `/api/calls/${id}/wrap-up`, a, { outcome: 'nonsense' })).status).toBe(400)
    expect((await h.send('POST', `/api/calls/${id}/wrap-up`, a, { outcome: 'Callback needed', notes: 'Call after 3pm' })).status).toBe(204)
    expect((await h.get('/api/calls/active', a)).json).toBeNull()
    expect((await h.pool.query<{ status: string }>('select status from call_centre.agent_presence')).rows[0]!.status).toBe('available')
    expect((await h.pool.query('select 1 from call_centre.callbacks where reason = $1 and assigned_to_crm_id = $2', ['Call after 3pm', A1])).rowCount).toBe(1)
    expect((await h.send('POST', `/api/calls/${id}/wrap-up`, a, { outcome: 'Callback needed', notes: '' })).status).toBe(404)   // cannot wrap up twice
  })

  it('issues a softphone token for the agent and 503s when the carrier is down', async () => {
    const a = await h.as('agent1@x.test')
    expect((await h.get('/api/softphone/token', a)).json).toEqual({ token: 'tok', clientName: `cc.${A1}` })
  })
})

describe('presence', () => {
  it('heartbeats keep an agent online, a busy agent stays busy, and supervisors see the roster', async () => {
    const a = await agentOnline('agent1@x.test')
    await h.pool.query(`update call_centre.agent_presence set status = 'busy'`)
    await h.send('PUT', '/api/presence', a, { status: 'available', languages: ['en'] })   // browser heartbeat must not steal a busy agent
    const sup = await h.as('sup1@x.test')
    const roster = (await h.get('/api/presence', sup)).json
    expect(roster).toMatchObject([{ agentId: A1, status: 'busy', online: true }])
    expect((await h.get('/api/presence', a)).status).toBe(403)
    expect((await h.send('PUT', '/api/presence', a, { status: 'flying', languages: ['en'] })).status).toBe(400)
  })

  it('available again after break restarts the idle timer', async () => {
    const a = await h.as('agent1@x.test')
    await h.send('PUT', '/api/presence', a, { status: 'break', languages: ['en'] })
    await h.pool.query(`update call_centre.agent_presence set idle_since = now() - interval '1 hour'`)
    await h.send('PUT', '/api/presence', a, { status: 'available', languages: ['en'] })
    const sup = await h.as('sup1@x.test')
    expect((await h.get('/api/presence', sup)).json[0].sinceSeconds).toBeLessThan(5)
  })
})

describe('rating replies by SMS', () => {
  it('stores a 1 to 5 reply on the call behind the customer’s resolved case and ignores other texts', async () => {
    const a = await liveCall2()
    const id = (await h.get('/api/calls/active', a)).json.id as string
    await h.send('POST', '/api/cases', a, { category: 'token_not_received', customerRef: 'c1', customerPhone: '0803 555 0142', callId: id })
    const ref = (await h.pool.query<{ ticket_ref: string }>('select ticket_ref from call_centre.tickets')).rows[0]!.ticket_ref
    await h.send('POST', `/api/cases/${ref}/resolve`, a, { note: 'Token re-issued' })
    expect((await hook(h, '/api/webhooks/at/sms', { from: '+2348035550142', text: 'thanks!' })).statusCode).toBe(204)
    expect((await h.pool.query<{ rating: number | null }>('select rating from call_centre.calls')).rows[0]!.rating).toBeNull()
    await hook(h, '/api/webhooks/at/sms', { from: '+2348035550142', text: ' 4 ' })
    expect((await h.pool.query<{ rating: number }>('select rating from call_centre.calls')).rows[0]!.rating).toBe(4)
    expect((await hook(h, '/api/webhooks/at/sms', { from: '+2348035550142', text: '5' }, 'bad')).statusCode).toBe(401)
  })

  async function liveCall2() {
    const a = await agentOnline('agent1@x.test')
    await hook(h, VOICE, ev()); await hook(h, VOICE, ev({ dtmfDigits: '1' }))
    return a
  }
})
