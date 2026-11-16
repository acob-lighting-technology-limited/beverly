import { beforeAll, describe, expect, it } from 'vitest'
import { INTERFACE_LOCALES } from '@beverly-call/shared'
import { callRoleFor } from '../src/beverly/beverly-auth.js'
import { boot, ORIGIN, TICKET_ID, type Harness } from './helpers.js'

/** Things Beverly already has that Beverly Call must line up with: roles, support tickets and languages. */
let h: Harness
beforeAll(async () => { h = await boot() })

const login = (email: string) => h.app.inject({ method: 'POST', url: '/api/auth/login', headers: { origin: ORIGIN, 'content-type': 'application/json' }, payload: { email, password: 'x' } })

describe('which Beverly roles can work the call desk', () => {
  it('derives the role from permissions, not a fixed list', () => {
    const both = ['wallet.support.manage', 'wallet.customers.view']
    expect(callRoleFor('operations-officer', both)).toBe('agent')
    expect(callRoleFor('custom-operations-officer', both)).toBe('agent')
    expect(callRoleFor('operations-manager', both)).toBe('supervisor')
    expect(callRoleFor('account', ['wallet.customers.view'])).toBeUndefined()       // can view customers but not manage support
    expect(callRoleFor('finance-checker', ['wallet.support.manage'])).toBeUndefined() // needs both
    expect(callRoleFor('vendor', [])).toBeUndefined()
    expect(callRoleFor('anything-else', null)).toBeUndefined()                        // permissions unknown: refuse
    expect(callRoleFor('super-admin', null)).toBe('admin')
    expect(callRoleFor('custom-call-centre-agent', null)).toBe('agent')
  })

  it('lets operations staff in and keeps account and finance staff out', async () => {
    expect((await login('opsofficer1@x.test')).statusCode).toBe(204)
    expect((await login('opsmanager1@x.test')).statusCode).toBe(204)
    expect((await login('acct1@x.test')).statusCode).toBe(403)
    const mgr = await h.as('opsmanager2@x.test'); const off = await h.as('opsofficer2@x.test')
    expect((await h.get('/api/session', mgr)).json.role).toBe('supervisor')
    expect((await h.get('/api/session', off)).json.role).toBe('agent')
    expect((await h.get('/api/wall', off)).status).toBe(403)
    expect((await h.get('/api/wall', mgr)).status).toBe(200)
  })
})

describe('Beverly support tickets in the call desk', () => {
  it('lists, filters and counts tickets, and maps Beverly’s fields', async () => {
    const a = await h.as('agent1@x.test')
    const list = (await h.get('/api/support/tickets', a)).json
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ id: TICKET_ID, reference: 'TKT-2026-00001', subject: 'Token not received', status: 'open', priority: 'normal', requesterName: 'Musa Garba', meterContext: '4201 8837 112' })
    expect((await h.get('/api/support/tickets?status=resolved', a)).json).toEqual([])
    expect((await h.get('/api/support/tickets?status=nonsense', a)).status).toBe(400)
    expect((await h.get('/api/support/stats', a)).json).toMatchObject({ total: 1, open: 1 })
  })

  it('opens a ticket with its conversation, including internal notes marked as such', async () => {
    const a = await h.as('agent1@x.test')
    const t = (await h.get(`/api/support/tickets/${TICKET_ID}`, a)).json
    expect(t.messages).toMatchObject([{ sender: 'Musa Garba', senderType: 'customer', body: 'I paid but no token', internal: false }])
    expect((await h.get('/api/support/tickets/not-a-uuid', a)).status).toBe(404)
    expect((await h.get(`/api/support/tickets/${'0'.repeat(8)}-0000-4000-8000-${'0'.repeat(12)}`, a)).status).toBe(404)
  })

  it('assigns, changes status and priority, replies and adds internal notes, each audited', async () => {
    const a = await h.as('agent1@x.test')
    const url = `/api/support/tickets/${TICKET_ID}`
    expect((await h.send('PATCH', url, a, { assignToMe: true })).json.assignedTo).not.toBeNull()
    expect((await h.send('PATCH', url, a, { status: 'pending', priority: 'high' })).json).toMatchObject({ status: 'pending', priority: 'high' })
    expect((await h.send('PATCH', url, a, { status: 'closed-ish' })).status).toBe(400)
    expect((await h.send('PATCH', url, a, {})).status).toBe(400)
    expect((await h.send('PATCH', url, a, { assignToMe: true, unassign: true })).status).toBe(400)
    const reply = await h.send('POST', `${url}/messages`, a, { body: 'We are checking your payment', internal: false })
    expect(reply.json.messages.at(-1)).toMatchObject({ body: 'We are checking your payment', internal: false })
    const note = await h.send('POST', `${url}/messages`, a, { body: 'Vend log looks fine', internal: true })
    expect(note.json.messages.at(-1)).toMatchObject({ internal: true })
    expect((await h.send('POST', `${url}/messages`, a, { body: '   ' })).status).toBe(400)
    await h.send('PATCH', url, a, { status: 'resolved' })
    const actions = (await h.pool.query<{ action: string }>(`select action from call_centre.audit_log where entity = 'support_ticket' order by seq`)).rows.map((x) => x.action)
    expect(actions).toEqual(['support.ticket.update', 'support.ticket.pending', 'support.ticket.reply', 'support.ticket.note', 'support.ticket.resolved'])
  })

  it('needs a session', async () => {
    expect((await h.app.inject('/api/support/tickets')).statusCode).toBe(401)
  })
})

describe('languages', () => {
  it('interface languages are exactly the four Beverly ships, with its native names and Nigerian locales', () => {
    expect(INTERFACE_LOCALES.map((l) => l.code)).toEqual(['en', 'yo', 'ha', 'ig'])
    expect(INTERFACE_LOCALES.map((l) => l.intl)).toEqual(['en-NG', 'yo-NG', 'ha-NG', 'ig-NG'])
    expect(INTERFACE_LOCALES.find((l) => l.code === 'yo')?.nativeLabel).toBe('Yorùbá')
    expect(INTERFACE_LOCALES.map((l) => l.code)).not.toContain('pcm')
  })
})

describe('Nigerian time (WAT, UTC+1)', () => {
  const lagosHour = (d = new Date()) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', hourCycle: 'h23' }).format(d))

  it('formats message times in Lagos, not UTC', async () => {
    const { hm } = await import('../src/time.js')
    expect(hm(new Date('2026-11-16T23:30:00Z'))).toBe('00:30')
    expect(hm(new Date('2026-11-16T08:05:00Z'))).toBe('09:05')
  })

  it('buckets the live wall’s hourly chart by Lagos hour', async () => {
    await h.reset()
    const sup = await h.as('sup1@x.test')
    await h.pool.query(`insert into call_centre.calls (at_session_id, direction, caller_number, queue, started_at, ended_at) values ('tz1','inbound','0803','general', now(), now())`)
    const w = (await h.get('/api/wall', sup)).json
    expect(w.hourly[lagosHour()]).toBeGreaterThanOrEqual(1)
  })

  it('puts a call in the Lagos day and hour on the heatmap and the metric trend', async () => {
    await h.reset()
    const sup = await h.as('sup1@x.test')
    await h.pool.query(`insert into call_centre.calls (at_session_id, direction, caller_number, queue, started_at, ended_at) values ('tz2','inbound','0803','general', now(), now())`)
    const x = (await h.get('/api/reports/extras?range=1', sup)).json
    expect(x.heatmap.flat().reduce((a: number, b: number) => a + b, 0)).toBe(1)
    const dow = (new Date().toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos', weekday: 'short' }))
    const idx = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(dow)
    expect(x.heatmap[idx][lagosHour()]).toBe(1)
    const m = (await h.get('/api/metrics/calls?period=24h', sup)).json
    expect(m.series.at(-1).label).toBe(String(lagosHour()).padStart(2, '0'))
    expect(m.series.reduce((a: number, s: { value: number }) => a + s.value, 0)).toBe(1)
  })

  it('moves a callback to 09:00 Lagos time tomorrow', async () => {
    await h.reset()
    const a = await h.as('agent1@x.test')
    const id = (await h.send('POST', '/api/callbacks', a, { phone: '0902 555 0121', minutes: 30 })).json.id
    const r = await h.send('POST', `/api/callbacks/${id}/reschedule`, a, { minutes: 1440, lastOutcome: 'No answer' })
    expect(r.json.time).toBe('09:00')
    expect(new Date(r.json.scheduledFor).getTime()).toBeGreaterThan(Date.now())
  })
})
