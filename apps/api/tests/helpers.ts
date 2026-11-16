import { createHash } from 'node:crypto'
import { vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { Pool } from 'pg'
import { buildApp } from '../src/app.js'
import { loadEnv, type Env } from '../src/config/env.js'
import { createCallCentreDb } from '../src/dev/pglite-pool.js'
import type { CommunicationsProvider } from '../src/telephony/provider.js'
import type { RecordingStorage } from '../src/storage/recording-storage.js'
import type { PushSender } from '../src/notify/notify.js'
import { resetStaffCache } from '../src/beverly/staff-directory.js'

/** Beverly staff ids are Supabase auth UUIDs. Deterministic ones per name keep tests readable. */
export const uid = (name: string): string => `00000000-0000-4000-8000-${createHash('sha1').update(name).digest('hex').slice(0, 12)}`
export const A1 = uid('agent1')
export const A2 = uid('agent2')
export const A9 = uid('agent9')
const NAME_OF = new Map<string, string>()

export const ORIGIN = 'https://call.test'
export const WEBHOOK_SECRET = 'webhook-secret-1234'

export const testEnv = (over: Record<string, string> = {}): Env => loadEnv({
  NODE_ENV: 'test', DATABASE_URL: 'postgres://u:p@localhost:5432/db', BEVERLY_AUTH_URL: 'https://auth.test',
  BEVERLY_AUTH_ANON_KEY: 'anon', BEVERLY_API_URL: 'https://api.test', SESSION_SECRET: 'x'.repeat(40), ALLOWED_ORIGIN: ORIGIN,
  AT_WEBHOOK_SECRET: WEBHOOK_SECRET, AT_VIRTUAL_NUMBER: '+2347000000000', API_PUBLIC_URL: 'https://api.call.test', LOGIN_RATE_LIMIT: '9999', BEVERLY_READ_MODE: 'api', ...over,
})

/** email prefix picks the role: agent1@, agent2@, sup@, admin@ */
const ROLE_OF = (name: string) => (name.startsWith('agent') ? 'custom-call-centre-agent' : name.startsWith('sup') ? 'custom-call-centre-supervisor' : name.startsWith('nocall') ? 'custom-call-centre-agent'
  : name.startsWith('opsofficer') ? 'operations-officer' : name.startsWith('opsmanager') ? 'operations-manager' : name.startsWith('acct') ? 'account' : 'super-admin')

/** Shapes copied from Beverly's admin API (backend/wallet/src/routes/admin.ts): money in kobo, search by q on name/phone/email. */
export const CUSTOMERS = [
  { id: 'c1', full_name: 'Musa Garba', phone: '08035550142', email: 'musa@x.test', status: 'active', balance_minor: 320000, available_minor: 320000, station_ids: ['KANO NORTH'] },
  { id: 'c2', full_name: 'Tope Bello', phone: '+2349025550121', email: null, status: 'active', balance_minor: 0, available_minor: 0, station_ids: ['IKEJA'] },
]
export const METERS: Record<string, { meter_id: string; status: string }[]> = {
  c1: [{ meter_id: '4201 8837 112', status: 'approved' }], c2: [{ meter_id: '4188 2043 771', status: 'pending' }],
}
export const PURCHASES = [{ id: 'p1', created_at: '2026-11-14T09:12:00Z', amount_minor: 500000, status: 'delivered', token: '3891 2207 5561 0000 4455', meter_id: '4201 8837 112' }]

/** Beverly support tickets as the admin API returns them (public.support_tickets rows). */
export const SUPPORT: Record<string, any>[] = []
export const TICKET_ID = uid('tkt-1')
export const MESSAGES: Record<string, unknown>[] = []
export function resetSupport(): void {
  SUPPORT.length = 0; MESSAGES.length = 0
  SUPPORT.push({ id: TICKET_ID, reference: 'TKT-2026-00001', subject: 'Token not received', category: 'vending', priority: 'normal', status: 'open', requester_actor_type: 'customer', requester_name: 'Musa Garba', customer_id: uid('cust-musa'), assigned_to_user_id: null, last_message_at: '2026-11-16T09:00:00Z', created_at: '2026-11-16T08:00:00Z', meter_context: { meter_id: '4201 8837 112' } })
  MESSAGES.push({ id: uid('m0'), ticket_id: TICKET_ID, sender_actor_type: 'customer', sender_name: 'Musa Garba', body: 'I paid but no token', is_internal: false, created_at: '2026-11-16T08:00:00Z' })
}
resetSupport()

export interface Fakes {
  provider: CommunicationsProvider & { sms: { to: string; text: string }[]; calls: { from: string; to: string }[] }
  storage: RecordingStorage & { uploaded: string[]; removed: string[] }
  pushed: string[]
}

export function makeFakes(configured = true): Fakes {
  const sms: { to: string; text: string }[] = []
  const calls: { from: string; to: string }[] = []
  const uploaded: string[] = []
  const removed: string[] = []
  return {
    provider: {
      configured, sms, calls,
      sendSms: vi.fn(async (to: string, text: string) => { sms.push({ to, text }); return { ref: 'm1', status: 'Sent' } }),
      makeCall: vi.fn(async (from: string, to: string) => { calls.push({ from, to }); return { ref: 's1' } }),
      webrtcToken: vi.fn(async (clientName: string) => ({ token: 'tok', clientName })),
    },
    storage: {
      uploaded, removed,
      signedUrl: vi.fn(async (b: string, k: string) => `https://signed.test/${b}/${k}`),
      remove: vi.fn(async (_b: string, k: string) => { removed.push(k) }),
      upload: vi.fn(async (_b: string, k: string) => { uploaded.push(k) }),
    },
    pushed: [],
  }
}

/** Beverly stub: sign-on, the staff profile row, customers, purchases and the staff list. */
export function beverlyFetch(): ReturnType<typeof vi.fn> {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status })
    if (url.includes('/auth/v1/token')) {
      const email = String((JSON.parse(String(init?.body)) as { email: string }).email)
      const name = email.split('@')[0]!
      NAME_OF.set(uid(name), name)
      return json({ access_token: `tok-${email}`, user: { id: uid(name), user_metadata: { full_name: name } } })
    }
    if (url.includes('/auth/v1/health')) return json({ ok: true })
    if (url.includes('/rest/v1/users')) {
      const email = NAME_OF.get(/auth_user_id=eq\.([^&]+)/.exec(url)?.[1] ?? '') ?? ''
      return json([{ role_key: ROLE_OF(email), portal_access: email.startsWith('nocall') ? ['crm'] : ['call'] }])
    }
    if (url.includes('/purchases')) return json({ purchases: PURCHASES, nextCursor: null })
    const meters = /customers\/([^/?]+)\/meters/.exec(url)
    if (meters) return json({ meters: METERS[meters[1]!] ?? [] })
    if (url.includes('/admin/customers')) {
      // Beverly matches q against name, phone and email with ilike %q%.
      const q = decodeURIComponent(/[?&]q=([^&]*)/.exec(url)?.[1] ?? '').toLowerCase()
      return json({ customers: CUSTOMERS.filter((c) => !q || `${c.full_name} ${c.phone} ${c.email ?? ''}`.toLowerCase().includes(q)), nextCursor: null })
    }
    if (url.includes('/admin/access/staff-status')) return json({ staff: [{ id: A1, auth_user_id: A1, user_name: 'Aisha Bello', email: 'aisha@x.test', role_key: 'custom-call-centre-agent', suspended: false, last_sign_in_at: null, portal_access: ['call'] }, { id: uid('x'), auth_user_id: uid('x'), user_name: 'Crm Only', role_key: 'x', suspended: false, portal_access: ['crm'] }] })
    const sup = /admin\/support\/tickets(?:\/([^/?]+))?(\/messages)?/.exec(url)
    if (sup) {
      const method = init?.method ?? 'GET'
      if (sup[1] === 'stats') return json({ total: SUPPORT.length, open: SUPPORT.filter((t) => t.status === 'open').length, pending: 0, awaiting_customer: 0, resolved: SUPPORT.filter((t) => t.status === 'resolved').length, closed: 0 })
      if (!sup[1]) { const st = /[?&]status=([^&]*)/.exec(url)?.[1]; return json({ tickets: SUPPORT.filter((t) => !st || t.status === st) }) }
      const t = SUPPORT.find((x) => x.id === sup[1])
      if (!t) return json({ error: 'not_found' }, 404)
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {}
      if (method === 'PATCH') { if (body.status) t.status = String(body.status); if (body.priority) t.priority = String(body.priority); if (body.assign_to_me) t.assigned_to_user_id = A1; if (body.unassign) t.assigned_to_user_id = null; return json({ ok: true }) }
      if (method === 'POST' && sup[2]) { MESSAGES.push({ id: uid(`m${MESSAGES.length}`), ticket_id: t.id, sender_actor_type: 'staff', sender_name: 'Staff', body: String(body.body), is_internal: Boolean(body.internal), created_at: new Date().toISOString() }); return json({ ok: true }) }
      return json({ ...t, support_ticket_messages: MESSAGES.filter((m) => m.ticket_id === t.id) })
    }
    return json({}, 404)
  })
}

export interface Harness {
  app: FastifyInstance
  pool: Pool
  fakes: Fakes
  env: Env
  /** Signs in and returns request headers carrying the session cookie and a valid Origin. */
  as(email: string): Promise<{ cookie: string; headers: Record<string, string> }>
  get(url: string, who: { cookie: string }): Promise<{ status: number; json: any }>
  send(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, who: { headers: Record<string, string> }, payload?: unknown): Promise<{ status: number; json: any }>
  reset(): Promise<void>
}

/** A full app on a real (in-memory) Postgres with the real migrations, and fake carrier, storage and push. */
export async function boot(over: Record<string, string> = {}, configured = true): Promise<Harness> {
  const { pool } = await createCallCentreDb()
  const fakes = makeFakes(configured)
  const env = testEnv(over)
  const send: PushSender = async (_s, payload) => { fakes.pushed.push(payload) }
  // Beverly roles that are not call-centre roles, with the permissions Beverly gives them (see callRoleFor).
  await pool.query(`insert into public.permissions (role_key, route_hash) values
    ('operations-officer','wallet.support.manage'),('operations-officer','wallet.customers.view'),
    ('operations-manager','wallet.support.manage'),('operations-manager','wallet.customers.view'),
    ('account','wallet.customers.view') on conflict do nothing`)
  const app = await buildApp({ env, pool, fetchImpl: beverlyFetch() as never, storage: fakes.storage, provider: fakes.provider, push: send })
  const parse = (r: { statusCode: number; body: string }) => ({ status: r.statusCode, json: r.body ? (() => { try { return JSON.parse(r.body) } catch { return r.body } })() : null })
  return {
    app, pool, fakes, env,
    async as(email) {
      const r = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { origin: ORIGIN, 'content-type': 'application/json' }, payload: { email, password: 'x' } })
      if (r.statusCode !== 204) throw new Error(`login failed for ${email}: ${r.statusCode} ${r.body}`)
      const cookie = String(r.headers['set-cookie']).split(';')[0]!
      return { cookie, headers: { cookie, origin: ORIGIN, 'content-type': 'application/json' } }
    },
    async get(url, who) { return parse(await app.inject({ url, headers: { cookie: who.cookie } })) },
    async send(method, url, who, payload) { return parse(await app.inject({ method, url, headers: who.headers, payload: payload as never })) },
    async reset() {
      resetStaffCache(); resetSupport()
      await pool.query(`truncate call_centre.calls, call_centre.tickets, call_centre.callbacks, call_centre.recordings, call_centre.agent_presence,
        call_centre.notifications, call_centre.notification_reads, call_centre.push_subscriptions, call_centre.sms_log, call_centre.settings,
        call_centre.retention_runs, call_centre.shift_handovers, call_centre.coaching_log, call_centre.customer_notes, call_centre.webhook_heartbeat restart identity cascade`)
      await pool.query('alter sequence call_centre.ticket_ref_seq restart with 2042')
      fakes.provider.sms.length = 0; fakes.provider.calls.length = 0; fakes.storage.uploaded.length = 0; fakes.storage.removed.length = 0; fakes.pushed.length = 0
    },
  }
}

/** Form-encoded carrier webhook with the shared secret. */
export const hook = (h: Harness, url: string, fields: Record<string, string>, secret = WEBHOOK_SECRET) =>
  h.app.inject({ method: 'POST', url, headers: { 'x-webhook-secret': secret, 'content-type': 'application/x-www-form-urlencoded' }, payload: new URLSearchParams(fields).toString() })
