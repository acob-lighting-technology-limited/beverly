import { beforeAll, describe, expect, it } from 'vitest'
import { A9, boot, ORIGIN, type Harness } from './helpers.js'

let h: Harness
beforeAll(async () => { h = await boot() })

describe('sign-in', () => {
  it('serves health without a session', async () => {
    expect((await h.app.inject('/api/health')).json()).toEqual({ status: 'ok' })
  })

  it('sets an httpOnly strict cookie and returns the session', async () => {
    const r = await h.app.inject({ method: 'POST', url: '/api/auth/login', headers: { origin: ORIGIN, 'content-type': 'application/json' }, payload: { email: 'agent1@x.test', password: 'x' } })
    expect(r.statusCode).toBe(204)
    const set = String(r.headers['set-cookie'])
    expect(set).toContain('HttpOnly')
    expect(set).toContain('SameSite=Strict')
    const me = await h.get('/api/session', { cookie: set.split(';')[0]! })
    expect(me.json).toMatchObject({ role: 'agent', name: 'agent1' })
  })

  it('refuses staff without call portal access', async () => {
    const r = await h.app.inject({ method: 'POST', url: '/api/auth/login', headers: { origin: ORIGIN, 'content-type': 'application/json' }, payload: { email: 'nocall@x.test', password: 'x' } })
    expect(r.statusCode).toBe(403)
  })

  it('rejects writes from another origin and malformed bodies', async () => {
    const bad = await h.app.inject({ method: 'POST', url: '/api/auth/login', headers: { origin: 'https://evil.test', 'content-type': 'application/json' }, payload: { email: 'a@b.co', password: 'x' } })
    expect(bad.statusCode).toBe(403)
    const junk = await h.app.inject({ method: 'POST', url: '/api/auth/login', headers: { origin: ORIGIN, 'content-type': 'application/json' }, payload: { email: 'not-an-email' } })
    expect(junk.statusCode).toBe(400)
  })

  it('records login and logout in the audit log and clears presence on logout', async () => {
    const a = await h.as('agent9@x.test')
    await h.send('PUT', '/api/presence', a, { status: 'available', languages: ['en'] })
    expect((await h.pool.query('select 1 from call_centre.agent_presence where agent_crm_id = $1', [A9])).rowCount).toBe(1)
    expect((await h.send('POST', '/api/auth/logout', a)).status).toBe(204)
    expect((await h.pool.query('select 1 from call_centre.agent_presence where agent_crm_id = $1', [A9])).rowCount).toBe(0)
    const acts = (await h.pool.query<{ action: string }>(`select action from call_centre.audit_log where actor_id = $1 order by seq`, [A9])).rows.map((x) => x.action)
    expect(acts).toEqual(['auth.login', 'auth.logout'])
  })

  it('protected routes need a session', async () => {
    for (const url of ['/api/cases', '/api/callbacks', '/api/calls/active', '/api/notifications', '/api/presence']) {
      expect((await h.app.inject(url)).statusCode).toBe(401)
    }
  })
})
