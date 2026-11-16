import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.js'
import { createCallCentreDb } from '../src/dev/pglite-pool.js'
import { ORIGIN, beverlyFetch, makeFakes, testEnv } from './helpers.js'

type R = 'agent' | 'supervisor' | 'admin'
const AGENT: R[] = ['agent', 'supervisor']
const STAFF: R[] = ['agent', 'supervisor', 'admin']
const LEAD: R[] = ['supervisor', 'admin']
const ADMIN: R[] = ['admin']

/** Source of truth for who may call what, mirroring the requireRole guards. `null` = public or secret-authenticated. */
const MATRIX: Record<string, R[] | null> = {
  'GET /api/health': null, 'POST /api/auth/login': null, 'POST /api/auth/logout': null,
  'POST /api/webhooks/at/voice': null, 'POST /api/webhooks/at/sms': null,
  'GET /api/session': STAFF,
  'PUT /api/presence': AGENT, 'DELETE /api/presence': AGENT, 'GET /api/presence/available': AGENT, 'GET /api/presence': LEAD,
  'GET /api/calls/active': AGENT, 'POST /api/calls/:id/wrap-up': AGENT, 'POST /api/calls/:id/transfer': AGENT,
  'GET /api/calls/:id/notes': AGENT, 'POST /api/calls/:id/notes': AGENT, 'GET /api/calls/:id/summary': AGENT, 'GET /api/softphone/token': AGENT,
  'GET /api/callbacks': AGENT, 'GET /api/callbacks/calendar': AGENT, 'POST /api/callbacks': AGENT,
  'POST /api/callbacks/:id/reschedule': AGENT, 'POST /api/callbacks/:id/start': AGENT, 'POST /api/callbacks/:id/complete': AGENT,
  'GET /api/cases': LEAD, 'GET /api/cases/mine': STAFF, 'POST /api/cases': STAFF, 'POST /api/cases/:id/assign': LEAD,
  'POST /api/cases/:id/resolve': STAFF, 'POST /api/cases/:id/comments': STAFF,
  'GET /api/customers': STAFF, 'GET /api/customers/:id/detail': STAFF, 'GET /api/customers/:id/full': STAFF,
  'POST /api/customers/:id/notes': STAFF, 'POST /api/customers/sms': STAFF, 'POST /api/customers/:id/token-reveal': STAFF,
  'GET /api/notifications': STAFF, 'POST /api/notifications/read': STAFF, 'GET /api/handover': STAFF, 'POST /api/handover': STAFF,
  'GET /api/replies': STAFF, 'GET /api/outages': STAFF, 'GET /api/push/key': STAFF, 'POST /api/push/subscribe': STAFF, 'POST /api/push/unsubscribe': STAFF,
  'GET /api/wall': LEAD, 'GET /api/recordings': LEAD, 'POST /api/recordings/:id/hold': LEAD, 'GET /api/recordings/:id/url': LEAD,
  'GET /api/reports': LEAD, 'GET /api/reports/extras': LEAD, 'GET /api/metrics/:key': LEAD, 'GET /api/audit': ADMIN,
  'GET /api/coaching': LEAD, 'POST /api/coaching': LEAD, 'GET /api/coaching/inbox': AGENT, 'POST /api/monitor': LEAD,
  'GET /api/qa/sample': LEAD, 'POST /api/qa/:callId': LEAD,
  'GET /api/admin/settings/:key': LEAD, 'PUT /api/admin/settings/:key': ADMIN, 'GET /api/admin/retention': ADMIN,
  'GET /api/admin/audit/verify': ADMIN, 'GET /api/admin/number': ADMIN, 'GET /api/admin/connections': ADMIN, 'GET /api/admin/users': ADMIN,
}
let ipN = 0
const nextIp = (): string => `10.0.${Math.floor(++ipN / 250)}.${ipN % 250 + 1}`
const EMAIL: Record<R, string> = { agent: 'agent1@x.test', supervisor: 'sup@x.test', admin: 'admin@x.test' }

describe('access matrix', () => {
  const seen: string[] = []
  let app: Awaited<ReturnType<typeof buildApp>>
  const cookies = {} as Record<R, string>

  beforeAll(async () => {
    const { pool } = await createCallCentreDb()
    app = await buildApp({ env: testEnv(), pool, fetchImpl: beverlyFetch() as never, storage: makeFakes().storage, provider: makeFakes().provider, push: null, onRoute: (m, u) => seen.push(`${m} ${u}`) })
    for (const role of Object.keys(EMAIL) as R[]) {
      const r = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { origin: ORIGIN, 'content-type': 'application/json' }, payload: { email: EMAIL[role], password: 'x' } })
      cookies[role] = String(r.headers['set-cookie']).split(';')[0]!
    }
  })
  afterAll(async () => { await app.close() })

  it('covers exactly the registered routes, so a new route cannot ship without a decision', () => {
    expect([...seen].sort()).toEqual(Object.keys(MATRIX).sort())
  })

  const call = (key: string, cookie?: string) => {
    const [method, url] = key.split(' ') as [string, string]
    const concrete = url.replace(':id', '00000000-0000-4000-8000-000000000001').replace(':callId', '00000000-0000-4000-8000-000000000001').replace(':key', 'alert_limits')
    return app.inject({ method: method as 'GET', url: concrete, headers: { origin: ORIGIN, 'content-type': 'application/json', 'x-forwarded-for': nextIp(), ...(cookie ? { cookie } : {}) }, payload: method === 'GET' ? undefined : ('{}' as never) })
  }

  for (const [key, roles] of Object.entries(MATRIX)) {
    if (roles === null) continue
    it(`${key}: signed-out is 401 and a role outside ${roles.join('/')} is 403`, async () => {
      expect((await call(key)).statusCode).toBe(401)
      for (const role of ['agent', 'supervisor', 'admin'] as R[]) {
        const code = (await call(key, cookies[role])).statusCode
        if (roles.includes(role)) expect([401, 403], `${role} must be allowed`).not.toContain(code)
        else expect(code, `${role} must be forbidden`).toBe(403)
      }
    })
  }

  it('webhooks reject a missing or wrong secret', async () => {
    for (const url of ['/api/webhooks/at/voice', '/api/webhooks/at/sms']) {
      const r = await app.inject({ method: 'POST', url, headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-for': nextIp() }, payload: 'sessionId=x' })
      expect(r.statusCode).toBe(401)
    }
  })

  it('writes without the allowed Origin are refused even when signed in', async () => {
    const r = await app.inject({ method: 'POST', url: '/api/handover', headers: { cookie: cookies.agent, origin: 'https://evil.test', 'content-type': 'application/json' }, payload: '{}' })
    expect(r.statusCode).toBe(403)
  })
})
