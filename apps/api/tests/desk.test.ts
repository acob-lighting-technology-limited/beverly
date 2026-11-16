import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { A1, A2, boot, hook, uid, type Harness } from './helpers.js'
import { verifyStoredChain } from '../src/audit/audit-log.js'
import { purgeExpiredRecordings } from '../src/jobs/purge-recordings.js'
import { ingestRecordings } from '../src/jobs/ingest-recordings.js'
import { notifySweep } from '../src/jobs/notify-sweep.js'

let h: Harness
beforeAll(async () => { h = await boot() })
beforeEach(async () => { await h.reset() })

const newCase = (over: Record<string, unknown> = {}) => ({ category: 'wallet_debited_no_token', customerRef: 'c1', customerPhone: '0803 555 0142', amountNgn: 5000, ...over })

describe('cases', () => {
  it('creates a case with a sequential reference, category SLA and audit', async () => {
    const a = await h.as('agent1@x.test')
    const r = await h.send('POST', '/api/cases', a, newCase())
    expect(r.status).toBe(201)
    expect(r.json).toMatchObject({ id: 'EX-2042', state: 'New', amount: 5000, customer: 'c1' })
    expect(r.json.slaMinutes).toBeGreaterThan(40)
    expect(r.json.slaMinutes).toBeLessThanOrEqual(45)
    expect((await h.send('POST', '/api/cases', a, newCase())).json.id).toBe('EX-2043')
    expect((await h.send('POST', '/api/cases', a, { category: 'nope', customerRef: 'c1' })).status).toBe(400)
    expect((await h.pool.query(`select 1 from call_centre.audit_log where action = 'case.create'`)).rowCount).toBe(2)
  })

  it('agents see only their own cases; supervisors see everything and can assign', async () => {
    const a = await h.as('agent1@x.test'); const b = await h.as('agent2@x.test'); const sup = await h.as('sup1@x.test')
    await h.send('POST', '/api/cases', a, newCase())
    expect((await h.get('/api/cases/mine', a)).json).toHaveLength(1)
    expect((await h.get('/api/cases/mine', b)).json).toHaveLength(0)
    expect((await h.get('/api/cases', a)).status).toBe(403)
    expect((await h.get('/api/cases', sup)).json).toHaveLength(1)
    expect((await h.send('POST', '/api/cases/EX-2042/assign', b, { agentId: A2 })).status).toBe(403)
    const r = await h.send('POST', '/api/cases/EX-2042/assign', sup, { agentId: A2 })
    expect(r.json).toMatchObject({ state: 'Working' })
    expect((await h.get('/api/cases/mine', b)).json).toHaveLength(1)
    expect((await h.pool.query(`select 1 from call_centre.notifications where user_crm_id = $1 and title like '%assigned to you'`, [A2])).rowCount).toBe(1)
  })

  it('only the holder (or a supervisor) can comment or resolve; resolving texts the customer once', async () => {
    const a = await h.as('agent1@x.test'); const b = await h.as('agent2@x.test'); const sup = await h.as('sup1@x.test')
    await h.send('POST', '/api/cases', a, newCase())
    expect((await h.send('POST', '/api/cases/EX-2042/comments', b, { text: 'hi' })).status).toBe(403)
    expect((await h.send('POST', '/api/cases/EX-2042/resolve', b, { note: 'x' })).status).toBe(403)
    expect((await h.send('POST', '/api/cases/EX-2042/resolve', a, { note: '  ' })).status).toBe(400)
    expect((await h.send('POST', '/api/cases/EX-2042/comments', a, { text: 'Called the vendor' })).json.comments[0]).toMatchObject({ by: 'agent1', text: 'Called the vendor' })
    const r = await h.send('POST', '/api/cases/EX-2042/resolve', sup, { note: 'Token re-issued' })
    expect(r.json.state).toBe('Done')
    expect(h.fakes.provider.sms).toEqual([{ to: '0803 555 0142', text: 'Your case EX-2042 is fixed. How was our service? Reply 1 to 5.' }])
    expect((await h.pool.query<{ status: string }>('select status from call_centre.sms_log')).rows[0]!.status).toBe('Sent')
    expect((await h.send('POST', '/api/cases/EX-2042/resolve', sup, { note: 'again' })).status).toBe(404)
    expect(h.fakes.provider.sms).toHaveLength(1)
  })

  it('records a skipped SMS when the carrier is not configured, and never blocks the resolve', async () => {
    const off = await boot({}, false)
    const a = await off.as('agent1@x.test')
    await off.send('POST', '/api/cases', a, newCase())
    expect((await off.send('POST', '/api/cases/EX-2042/resolve', a, { note: 'done' })).json.state).toBe('Done')
    expect((await off.pool.query<{ status: string }>('select status from call_centre.sms_log')).rows[0]!.status).toContain('skipped')
  })
})

describe('callbacks', () => {
  it('creates, lists (agents see their own plus unassigned), reschedules, dials and completes', async () => {
    const a = await h.as('agent1@x.test'); const b = await h.as('agent2@x.test')
    const c = await h.send('POST', '/api/callbacks', a, { phone: '0902 555 0121', language: 'yo', reason: 'Meter query', minutes: 30 })
    expect(c.status).toBe(201)
    const id = c.json.id as string
    expect((await h.get('/api/callbacks', a)).json).toHaveLength(1)
    expect((await h.get('/api/callbacks', b)).json).toHaveLength(0)    // assigned to agent1
    const r = await h.send('POST', `/api/callbacks/${id}/reschedule`, a, { minutes: 60, lastOutcome: 'No answer', note: 'try later' })
    expect(r.json.status).toBe('Later')
    expect((await h.send('POST', `/api/callbacks/${id}/reschedule`, a, { minutes: 7, lastOutcome: 'No answer' })).status).toBe(400)
    const tomorrow = await h.send('POST', `/api/callbacks/${id}/reschedule`, a, { minutes: 1440, lastOutcome: 'Line busy' })
    expect(new Date(tomorrow.json.scheduledFor).getTime()).toBeGreaterThan(Date.now() + 3600_000)
    const start = await h.send('POST', `/api/callbacks/${id}/start`, a)
    expect(start.json).toEqual({ dialled: true })
    expect(h.fakes.provider.calls).toEqual([{ from: '+2347000000000', to: '0902 555 0121' }])
    expect((await h.pool.query<{ attempts: number }>('select attempts from call_centre.callbacks')).rows[0]!.attempts).toBe(1)
    expect((await h.send('POST', `/api/callbacks/${id}/complete`, a)).status).toBe(204)
    expect((await h.get('/api/callbacks', a)).json).toHaveLength(0)
    expect((await h.send('POST', `/api/callbacks/${id}/complete`, a)).status).toBe(404)
  })

  it('calendar counts callbacks per day', async () => {
    const a = await h.as('agent1@x.test')
    await h.send('POST', '/api/callbacks', a, { phone: '0902 555 0121', minutes: 0 })
    await h.send('POST', '/api/callbacks', a, { phone: '0902 555 0122', minutes: 0 })
    const cal = (await h.get(`/api/callbacks/calendar?month=${new Date().toISOString().slice(0, 7)}`, a)).json
    expect(cal[0]).toMatchObject({ day: new Date().getUTCDate(), count: 2 })
    expect((await h.get('/api/callbacks/calendar?month=nope', a)).status).toBe(400)
  })
})

describe('customers', () => {
  it('searches Beverly, audits searches and masks tokens in purchase history', async () => {
    const a = await h.as('agent1@x.test')
    expect((await h.get('/api/customers?q=musa', a)).json).toMatchObject([{ id: 'c1', meter: '4201 8837 112' }])
    expect((await h.pool.query(`select 1 from call_centre.audit_log where action = 'customer.search'`)).rowCount).toBe(1)
    const d = (await h.get('/api/customers/c1/detail', a)).json
    expect(d.purchases[0]).toMatchObject({ id: 'p1', amount: 5000, tokenMasked: '•••• •••• •••• 4455' })
    expect(JSON.stringify(d)).not.toContain('3891')
  })

  it('builds notes, one timeline, the case funnel and callbacks from our data', async () => {
    const a = await h.as('agent1@x.test')
    await h.send('POST', '/api/customers/c1/notes', a, { text: 'Prefers Hausa' })
    await h.send('POST', '/api/cases', a, newCase())
    await h.send('POST', '/api/cases/EX-2042/resolve', a, { note: 'fixed' })
    await h.send('POST', '/api/callbacks', a, { phone: '0803 555 0142', customerRef: 'c1' })
    const f = (await h.get('/api/customers/c1/full', a)).json
    expect(f.notes[0]).toMatchObject({ by: 'agent1', text: 'Prefers Hausa' })
    expect(f.stages).toEqual({ reported: 1, escalated: 1, working: 0, fixed: 1 })
    expect(f.timeline.map((e: { kind: string }) => e.kind).sort()).toEqual(['callback', 'case', 'note'])
    expect(f.callbacks).toHaveLength(1)
    expect((await h.send('POST', '/api/customers/c1/notes', a, { text: '' })).status).toBe(400)
  })

  it('releases the raw token only after all checks and a reason, and audits it first', async () => {
    const a = await h.as('agent1@x.test')
    const base = { purchaseId: 'p1', reason: 'Customer asked for the token' }
    expect((await h.send('POST', '/api/customers/c1/token-reveal', a, { ...base, verified: { name: true, meter: true, lastVend: false } })).status).toBe(400)
    expect((await h.send('POST', '/api/customers/c1/token-reveal', a, { ...base, reason: 'because', verified: { name: true, meter: true, lastVend: true } })).status).toBe(400)
    expect((await h.send('POST', '/api/customers/c1/token-reveal', a, { ...base, purchaseId: 'nope', verified: { name: true, meter: true, lastVend: true } })).status).toBe(404)
    expect((await h.pool.query(`select 1 from call_centre.audit_log where action = 'token.reveal'`)).rowCount).toBe(0)
    const ok = await h.send('POST', '/api/customers/c1/token-reveal', a, { ...base, verified: { name: true, meter: true, lastVend: true } })
    expect(ok.json).toEqual({ token: '3891 2207 5561 0000 4455' })
    const row = (await h.pool.query<{ metadata: { reason: string } }>(`select metadata from call_centre.audit_log where action = 'token.reveal'`)).rows[0]!
    expect(row.metadata.reason).toBe('Customer asked for the token')
  })

  it('sends a logged SMS to the customer', async () => {
    const a = await h.as('agent1@x.test')
    const r = await h.send('POST', '/api/customers/sms', a, { phone: '0803 555 0142', text: 'Please send your meter number', customerRef: 'c1' })
    expect(r.json).toEqual({ result: 'sent' })
    expect((await h.pool.query<{ kind: string }>('select kind from call_centre.sms_log')).rows[0]!.kind).toBe('agent')
    expect((await h.send('POST', '/api/customers/sms', a, { phone: '1', text: '' })).status).toBe(400)
  })
})

describe('supervision', () => {
  it('coaching prompts reach only the agent once, monitor needs a live call, QA scores notify the agent', async () => {
    const a = await h.as('agent1@x.test'); const sup = await h.as('sup1@x.test')
    expect((await h.send('POST', '/api/coaching', a, { agentId: A1, text: 'x' })).status).toBe(403)
    await h.send('POST', '/api/coaching', sup, { agentId: A1, text: 'Offer a callback' })
    expect((await h.get('/api/coaching', sup)).json[0].text).toBe('Prompt: Offer a callback')
    expect((await h.get('/api/coaching/inbox', a)).json).toMatchObject([{ text: 'Offer a callback' }])
    expect((await h.get('/api/coaching/inbox', a)).json).toEqual([])
    expect((await h.send('POST', '/api/monitor', sup, { mode: 'listen', agentId: A1 })).status).toBe(409)

    await h.pool.query(`insert into call_centre.calls (at_session_id, direction, caller_number, queue, agent_crm_id) values ('S','inbound','0803','general',$1)`, [A1])
    const m = await h.send('POST', '/api/monitor', sup, { mode: 'whisper', agentId: A1 })
    expect(m.status).toBe(200)
    expect((await h.get('/api/coaching', sup)).json[0].text).toBe(`Whispered to ${A1}`)
    expect((await h.send('POST', '/api/monitor', sup, { mode: 'end', agentId: A1 })).status).toBe(200)

    await h.pool.query(`update call_centre.calls set ended_at = now()`)
    const sample = (await h.get('/api/qa/sample', sup)).json
    expect(sample).toHaveLength(1)
    expect((await h.send('POST', `/api/qa/${sample[0].callId}`, sup, { score: 120 })).status).toBe(400)
    expect((await h.send('POST', `/api/qa/${sample[0].callId}`, sup, { score: 88, notes: 'Great' })).status).toBe(204)
    expect((await h.get('/api/qa/sample', sup)).json[0].score).toBe(88)
    expect((await h.pool.query(`select 1 from call_centre.notifications where user_crm_id = $1 and title like 'Supervisor scored%'`, [A1])).rowCount).toBe(1)
  })
})

describe('inbox', () => {
  it('stores real notifications only, tracks read state per user, and push fan-out removes dead subscriptions', async () => {
    const a = await h.as('agent1@x.test'); const b = await h.as('agent2@x.test'); const sup = await h.as('sup1@x.test')
    expect((await h.get('/api/notifications', a)).json).toEqual([])               // nothing is fabricated
    await h.send('POST', '/api/push/subscribe', a, { endpoint: 'https://push.test/a', keys: { p256dh: 'p', auth: 'a' } })
    await h.send('POST', '/api/coaching', sup, { agentId: A1, text: 'Keep it short' })
    expect(h.fakes.pushed).toHaveLength(1)
    const list = (await h.get('/api/notifications', a)).json
    expect(list).toMatchObject([{ title: expect.stringContaining('Coaching'), unread: true }])
    expect((await h.get('/api/notifications', b)).json).toEqual([])               // private to agent1
    await h.send('POST', '/api/notifications/read', a, { keys: [list[0].key] })
    expect((await h.get('/api/notifications', a)).json[0].unread).toBe(false)
    await h.send('POST', '/api/push/unsubscribe', a, { endpoint: 'https://push.test/a' })
    expect((await h.pool.query('select 1 from call_centre.push_subscriptions')).rowCount).toBe(0)
  })

  it('sweeps overdue cases and due callbacks once each', async () => {
    const a = await h.as('agent1@x.test')
    await h.send('POST', '/api/cases', a, newCase())
    await h.pool.query(`update call_centre.tickets set sla_due_at = now() - interval '5 minutes'`)
    await h.send('POST', '/api/callbacks', a, { phone: '0902 555 0121', minutes: 5 })
    expect(await notifySweep(h.pool, null)).toBe(2)
    expect(await notifySweep(h.pool, null)).toBe(0)
    const titles = (await h.get('/api/notifications', a)).json.map((n: { title: string }) => n.title)
    expect(titles).toEqual(expect.arrayContaining(['EX-2042 is past its deadline', 'Callback due soon']))
  })

  it('shift handover, saved replies and outages', async () => {
    const a = await h.as('agent1@x.test'); const adm = await h.as('admin1@x.test')
    expect((await h.get('/api/handover', a)).json).toEqual({ latest: null })
    await h.send('POST', '/api/handover', a, { body: 'Two Hausa callbacks pending' })
    expect((await h.get('/api/handover', a)).json.latest).toMatchObject({ by: 'agent1', body: 'Two Hausa callbacks pending' })
    expect((await h.get('/api/replies', a)).json.length).toBeGreaterThan(3)
    await h.send('PUT', '/api/admin/settings/saved_replies', adm, ['One', 'Two'])
    expect((await h.get('/api/replies', a)).json).toEqual(['One', 'Two'])
    expect((await h.get('/api/outages', a)).json).toEqual([])
  })
})

describe('wall, reports and metrics', () => {
  async function seedCalls() {
    const rows = [[A1, 'en', 100, 'Resolved on the call', 5, 4], [A1, 'ha', 200, 'Resolved on the call', 3, 6], [A2, 'en', 300, 'Escalated to wallet staff', null, 2]]
    for (const [i, r] of rows.entries()) {
      await h.pool.query(
        `insert into call_centre.calls (at_session_id, direction, caller_number, queue, agent_crm_id, language, started_at, answered_at, ended_at, disposition, rating, cost_ngn)
         values ($1,'inbound','0803',$2,$3,$4, now() - interval '30 minutes', now() - interval '30 minutes' + interval '10 seconds', now() - interval '30 minutes' + ($5 || ' seconds')::interval, $6, $7, $8)`,
        [`s${i}`, 'general', r[0], r[1], String(r[2]), r[3], r[4], r[5]])
    }
    await h.pool.query(`insert into call_centre.calls (at_session_id, direction, caller_number, queue, started_at, ended_at, disposition) values ('ab','inbound','0803','general', now() - interval '20 minutes', now() - interval '19 minutes', 'no_agent')`)
  }

  it('the wall reports live numbers and raises alerts from the admin limits', async () => {
    const sup = await h.as('sup1@x.test'); const adm = await h.as('admin1@x.test')
    await seedCalls()
    await h.send('PUT', '/api/admin/settings/alert_limits', adm, { longestWaitSeconds: 60, abandonRatePct: 5, creditDays: 7 })
    const w = (await h.get('/api/wall', sup)).json
    expect(w).toMatchObject({ activeCalls: 0, abandonedPct: 25, serviceLevelPct: 75 })
    expect(w.alerts.join()).toContain('Abandon rate 25%')
    expect(w.hourly).toHaveLength(24)
  })

  it('reports: totals, extras (heatmap, forecast, leaderboard, cost, languages) and metric trends', async () => {
    const sup = await h.as('sup1@x.test')
    await seedCalls()
    expect((await h.get('/api/reports?range=1', sup)).json).toMatchObject({ calls: 4, firstCallResolvedPct: 50 })
    const x = (await h.get('/api/reports/extras?range=7', sup)).json
    expect(x.heatmap).toHaveLength(7)
    expect(x.heatmap.flat().reduce((a: number, b: number) => a + b, 0)).toBe(4)
    expect(x.forecast).toHaveLength(7)
    expect(x.leaderboard[0]).toMatchObject({ agentId: A1, calls: 2, avgRating: 4 })
    expect(x.avgCostNgn).toBe(4)
    expect(x.languages).toEqual(expect.arrayContaining([{ language: 'ha', count: 1 }]))
    const m = (await h.get('/api/metrics/calls?period=24h', sup)).json
    expect(m).toMatchObject({ key: 'calls', unit: 'calls', current: expect.any(Number) })
    expect(m.series).toHaveLength(24)
    expect(m.series.reduce((a: number, s: { value: number }) => a + s.value, 0)).toBe(4)
    expect((await h.get('/api/metrics/calls?period=30d', sup)).json.series).toHaveLength(30)
    for (const key of ['handle_time', 'abandoned', 'service_level', 'open_cases', 'overdue_cases']) expect((await h.get(`/api/metrics/${key}?period=7d`, sup)).status).toBe(200)
    expect((await h.get('/api/metrics/evil;drop?period=24h', sup)).status).toBe(400)
    expect((await h.get('/api/reports?range=99', sup)).status).toBe(400)
  })

  it('recordings: list, hold, playback needs an ingested file, and agents are refused', async () => {
    const a = await h.as('agent1@x.test'); const sup = await h.as('sup1@x.test')
    await hook(h, '/api/webhooks/at/voice', { sessionId: 'R', isActive: '0', callerNumber: '0803', durationInSeconds: '60', recordingUrl: 'https://rec.test/r.mp3' })
    const id = (await h.get('/api/recordings', sup)).json[0].id as string
    expect((await h.get('/api/recordings', a)).status).toBe(403)
    expect((await h.get(`/api/recordings/${id}/url`, sup)).status).toBe(409)       // not yet saved
    await ingestRecordings(h.pool, h.fakes.storage, (async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'audio/mpeg' } })) as never)
    expect(h.fakes.storage.uploaded).toEqual(['calls/R.mp3'])
    expect((await h.get(`/api/recordings/${id}/url`, sup)).json.url).toBe('https://signed.test/call-recordings/calls/R.mp3')
    expect((await h.send('POST', `/api/recordings/${id}/hold`, sup, { hold: true })).status).toBe(204)
    expect((await h.get('/api/recordings', sup)).json[0].legalHold).toBe(true)
    expect((await h.send('POST', `/api/recordings/${id}/hold`, sup, { hold: 'yes' })).status).toBe(400)
  })
})

describe('jobs', () => {
  it('ingest refuses non-https sources and retries failures', async () => {
    await h.pool.query(`insert into call_centre.calls (at_session_id, direction, caller_number, queue) values ('J','inbound','0803','general')`)
    const cid = (await h.pool.query<{ id: string }>('select id from call_centre.calls')).rows[0]!.id
    await h.pool.query(`insert into call_centre.recordings (call_id, storage_key, storage_bucket, expires_at, source_url) values ($1,'a.mp3','b', now() + interval '1 day','http://insecure.test/a.mp3')`, [cid])
    expect(await ingestRecordings(h.pool, h.fakes.storage)).toEqual({ ingested: 0, failed: 1 })
    expect(h.fakes.storage.uploaded).toHaveLength(0)
  })

  it('purge deletes expired files, skips legal holds, retries failures and logs each run', async () => {
    await h.pool.query(`insert into call_centre.calls (at_session_id, direction, caller_number, queue) values ('P','inbound','0803','general')`)
    const cid = (await h.pool.query<{ id: string }>('select id from call_centre.calls')).rows[0]!.id
    for (const [k, hold] of [['old1', false], ['old2', false], ['held', true]] as const) {
      await h.pool.query(`insert into call_centre.recordings (call_id, storage_key, storage_bucket, expires_at, legal_hold) values ($1,$2,'b', now() - interval '1 day', $3)`, [cid, k, hold])
    }
    expect(await purgeExpiredRecordings(h.pool, h.fakes.storage)).toEqual({ deleted: 2, held: 1, failed: 0 })
    expect(h.fakes.storage.removed.sort()).toEqual(['old1', 'old2'])
    expect((await h.pool.query('select 1 from call_centre.recordings where deleted_at is null')).rowCount).toBe(1)
    const adm = await h.as('admin1@x.test')
    expect((await h.get('/api/admin/retention', adm)).json).toMatchObject({ lastDeleted: 2, lastHeld: 1, pendingPurge: 0 })
  })
})

describe('admin', () => {
  it('settings are admin-only for writes, validated, audited and fall back to defaults', async () => {
    const sup = await h.as('sup1@x.test'); const adm = await h.as('admin1@x.test')
    expect((await h.send('PUT', '/api/admin/settings/alert_limits', sup, { longestWaitSeconds: 60, abandonRatePct: 5, creditDays: 7 })).status).toBe(403)
    expect((await h.send('PUT', '/api/admin/settings/alert_limits', adm, { longestWaitSeconds: 5000, abandonRatePct: 5, creditDays: 7 })).status).toBe(400)
    expect((await h.get('/api/admin/settings/call_flow', adm)).json).toHaveLength(5)
    await h.send('PUT', '/api/admin/settings/call_flow', adm, [{ id: 'w', title: 'Welcome', detail: 'New wording' }])
    expect((await h.get('/api/admin/settings/call_flow', adm)).json).toEqual([{ id: 'w', title: 'Welcome', detail: 'New wording' }])
    expect((await h.get('/api/admin/settings/nope', adm)).status).toBe(404)
  })

  it('the audit chain stays valid across many concurrent writes and detects tampering', async () => {
    const a = await h.as('agent1@x.test')
    await Promise.all(Array.from({ length: 12 }, (_, i) => h.send('POST', '/api/handover', a, { body: `note ${i}` })))
    const ok = await verifyStoredChain(h.pool)
    expect(ok.brokenAt).toBeNull()
    expect(ok.checked).toBeGreaterThan(12)
    const adm = await h.as('admin1@x.test')
    expect((await h.get('/api/admin/audit/verify', adm)).json).toMatchObject({ brokenAt: null })
    // The API role cannot edit or delete audit rows (append-only trigger), even as owner here.
    await expect(h.pool.query(`update call_centre.audit_log set action = 'x'`)).rejects.toThrow(/append-only/)
    await expect(h.pool.query('delete from call_centre.audit_log')).rejects.toThrow(/append-only/)
  })

  it('connections report real health, users come from Beverly filtered to the call portal, number info', async () => {
    const adm = await h.as('admin1@x.test'); const a = await h.as('agent1@x.test')
    const c = (await h.get('/api/admin/connections', adm)).json as { name: string; ok: boolean }[]
    expect(c.find((x) => x.name === 'Database')!.ok).toBe(true)
    expect(c.find((x) => x.name === 'Beverly sign-on')!.ok).toBe(true)
    expect(c.find((x) => x.name === 'Carrier webhooks')!.ok).toBe(false)           // no events yet
    await hook(h, '/api/webhooks/at/voice', { sessionId: 'H', isActive: '0', callerNumber: '0803' })
    expect(((await h.get('/api/admin/connections', adm)).json as { name: string; ok: boolean }[]).find((x) => x.name === 'Carrier webhooks')!.ok).toBe(true)
    expect((await h.get('/api/admin/users', adm)).json).toEqual([{ id: A1, name: 'Aisha Bello', role: 'custom-call-centre-agent', active: true, lastLogin: null }])
    expect((await h.get('/api/admin/number', adm)).json).toEqual({ virtualNumber: '+2347000000000', retentionDays: 90 })
    for (const u of ['/api/admin/users', '/api/admin/connections', '/api/admin/number', '/api/admin/audit/verify']) expect((await h.get(u, a)).status).toBe(403)
  })
})

describe('unit', () => {
  it('uid helper is stable and a valid uuid', () => expect(uid('agent1')).toMatch(/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/))
})
