/**
 * LOCAL DEVELOPMENT ONLY. Runs the real API against an in-memory Postgres (PGlite) with the real migrations applied,
 * a stubbed Beverly sign-on and sample data. Refuses to start in production. Never deploy this entry point.
 *
 * Sign in with any password. The email prefix picks the role: agent@..., sup@..., admin@...
 * No notifications are seeded: the bell only ever shows what the app itself raises from real events.
 */
import { buildApp } from '../app.js'
import { loadEnv } from '../config/env.js'
import { createCallCentreDb } from './pglite-pool.js'
import type { CommunicationsProvider } from '../telephony/provider.js'
import type { RecordingStorage } from '../storage/recording-storage.js'

if (process.env.NODE_ENV === 'production') throw new Error('dev-server must not run in production')

const env = loadEnv({
  NODE_ENV: 'development', PORT: '8787', DATABASE_URL: 'postgres://dev:dev@localhost:5432/dev',
  BEVERLY_AUTH_URL: 'https://beverly.dev.test', BEVERLY_AUTH_ANON_KEY: 'dev', BEVERLY_API_URL: 'https://beverly.dev.test',
  SESSION_SECRET: 'dev-only-secret-dev-only-secret-dev-only', ALLOWED_ORIGIN: 'http://127.0.0.1:5173',
  AT_WEBHOOK_SECRET: 'dev-webhook-secret-1234', AT_VIRTUAL_NUMBER: '+2347000000000', LOGIN_RATE_LIMIT: '200',
})

const uid = (name: string): string => `00000000-0000-4000-8000-${Buffer.from(name).toString('hex').slice(0, 12).padStart(12, '0')}`
const SEED_AGENTS = [['chidi', 'Chidi Okafor', ['en', 'ig'], 'available'], ['tunde', 'Tunde Ade', ['en', 'yo', 'pcm'], 'acw'], ['ngozi', 'Ngozi Eze', ['en', 'ig'], 'available'], ['ibrahim', 'Ibrahim Sani', ['en', 'ha'], 'break'], ['sade', 'Sade Ola', ['en', 'yo'], 'busy']] as const

const { pool } = await createCallCentreDb()

/* ---- sample data (real tables, real SQL) ---- */
for (const [id, name, langs, status] of SEED_AGENTS) {
  await pool.query(`insert into call_centre.agent_presence (agent_crm_id, name, client_name, status, languages, idle_since) values ($1,$2,$3,$4,$5::text[], now() - interval '3 minutes')`, [uid(id), name, `cc.${uid(id)}`, status, langs])
}
await pool.query(`
  insert into call_centre.calls (at_session_id, direction, caller_number, queue, agent_crm_id, language, started_at, answered_at, ended_at, disposition, rating, cost_ngn)
  select 'seed-' || g, 'inbound', '0803 555 0' || lpad((100 + g % 40)::text, 3, '0'), 'general',
         (array[$1,$2,$3,$4])[1 + g % 4], (array['en','ha','yo','ig','pcm'])[1 + g % 5],
         now() - ((g % 7) || ' days')::interval - ((g * 37 % 600) || ' minutes')::interval,
         now() - ((g % 7) || ' days')::interval - ((g * 37 % 600) || ' minutes')::interval + interval '8 seconds',
         now() - ((g % 7) || ' days')::interval - ((g * 37 % 600) || ' minutes')::interval + ((120 + g * 11 % 300) || ' seconds')::interval,
         (array['Resolved on the call','Resolved on the call','Escalated to wallet staff','Callback needed'])[1 + g % 4],
         case when g % 3 = 0 then 3 + g % 3 else null end, 3.5 + (g % 5)
  from generate_series(1, 90) g`, [uid('chidi'), uid('tunde'), uid('ngozi'), uid('sade')])
await pool.query(`insert into call_centre.tickets (ticket_ref, customer_ref, category, priority, agent_crm_id, sla_due_at, status, amount_ngn, customer_phone) values
  ('EX-2041','c1','wallet_debited_no_token','HIGH',$1, now() + interval '3 hours','OPEN',5000,'0803 555 0142'),
  ('EX-2040','c2','token_not_received','MEDIUM',$2, now() + interval '5 hours','INVESTIGATING',3000,'0706 555 0188'),
  ('EX-2039','c3','wrong_meter_credited','MEDIUM',$1, now() + interval '8 hours','OPEN',2000,'0902 555 0121')`, [uid('chidi'), uid('tunde')])
await pool.query(`insert into call_centre.callbacks (callback_ref, phone_number, language, reason, scheduled_for) values
  ('CB-DEMO1','0902 555 0121','yo','Meter query', now() + interval '2 hours'), ('CB-DEMO2','0813 555 0199','ha','Token not received', now() + interval '4 hours')`)
await pool.query(`insert into call_centre.recordings (call_id, storage_key, storage_bucket, duration_seconds, expires_at, ingested_at)
  select id, 'calls/' || at_session_id || '.mp3', 'call-recordings', 150, now() + interval '80 days', now() from call_centre.calls where at_session_id like 'seed-%' order by started_at desc limit 6`)
await pool.query(`update call_centre.recordings set legal_hold = true where id = (select id from call_centre.recordings limit 1)`)
// A live call for the dev agent so the call screen has something to show.
await pool.query(`insert into call_centre.calls (at_session_id, direction, caller_number, queue, agent_crm_id, started_at, answered_at) values ('seed-live','inbound','+2348035550142','general',$1, now() - interval '2 minutes', now() - interval '2 minutes')`, [uid('agent')])
await pool.query(`insert into call_centre.agent_presence (agent_crm_id, name, client_name, status, languages) values ($1,'agent','cc.agent','busy','{en,ha}')`, [uid('agent')])
setInterval(() => { void pool.query(`update call_centre.agent_presence set last_seen = now() where agent_crm_id = any($1::text[])`, [SEED_AGENTS.map((a) => uid(a[0]))]) }, 30_000)

/* ---- stubbed Beverly, carrier and storage ---- */
const names = new Map<string, string>()
const ROLE_KEY = (n: string) => (n.startsWith('agent') ? 'custom-call-centre-agent' : n.startsWith('sup') ? 'custom-call-centre-supervisor' : 'super-admin')
/** Shapes follow Beverly's admin API: money in kobo, search by q on name/phone/email, meters on their own route. */
const CUSTOMERS = [
  { id: 'c1', full_name: 'Musa Garba', phone: '08035550142', email: 'musa@example.test', status: 'active', balance_minor: 320000, station_ids: ['KANO NORTH'] },
  { id: 'c2', full_name: 'Ngozi Obi', phone: '+2347065550188', email: null, status: 'active', balance_minor: 840000, station_ids: ['ENUGU EAST'] },
  { id: 'c3', full_name: 'Tope Bello', phone: '09025550121', email: null, status: 'active', balance_minor: 40000, station_ids: ['IKEJA'] },
]
const METERS: Record<string, string> = { c1: '4201 8837 112', c2: '4201 7710 306', c3: '4188 2043 771' }
const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
  const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 })
  if (url.includes('/auth/v1/token')) { const n = String((JSON.parse(String(init?.body)) as { email: string }).email).split('@')[0]!; names.set(uid(n), n); return json({ access_token: `dev-${n}`, user: { id: uid(n), user_metadata: { full_name: n } } }) }
  if (url.includes('/auth/v1/health')) return json({ ok: true })
  if (url.includes('/rest/v1/users')) { const n = names.get(/auth_user_id=eq\.([^&]+)/.exec(url)?.[1] ?? '') ?? ''; return json([{ role_key: ROLE_KEY(n), portal_access: ['call'] }]) }
  if (url.includes('/purchases')) return json({ purchases: [{ id: 'p1', created_at: new Date(Date.now() - 864e5).toISOString(), amount_minor: 500000, status: 'delivered', token: '3891 2207 5561 0000 4455' }, { id: 'p2', created_at: new Date(Date.now() - 3 * 864e5).toISOString(), amount_minor: 300000, status: 'delivered', token: '1122 3344 5566 7788 9900' }], nextCursor: null })
  const meters = /customers\/([^/?]+)\/meters/.exec(url)
  if (meters) return json({ meters: [{ meter_id: METERS[meters[1]!] ?? '', status: 'approved' }] })
  if (url.includes('/admin/access/staff-status')) return json({ staff: SEED_AGENTS.map(([id, name]) => ({ id: uid(id), auth_user_id: uid(id), user_name: name, role_key: 'custom-call-centre-agent', suspended: false, last_sign_in_at: new Date(Date.now() - 36e5).toISOString(), portal_access: ['call'] })) })
  if (url.includes('/admin/customers')) {
    const q = decodeURIComponent(/[?&]q=([^&]*)/.exec(url)?.[1] ?? '').toLowerCase()
    return json({ customers: CUSTOMERS.filter((c) => !q || `${c.full_name} ${c.phone} ${c.email ?? ''}`.toLowerCase().includes(q)), nextCursor: null })
  }
  return new Response('{}', { status: 404 })
}
const provider: CommunicationsProvider = {
  configured: true,
  sendSms: async (to, text) => { console.log(`[dev sms] ${to}: ${text}`); return { ref: 'dev', status: 'Sent' } },
  makeCall: async (from, to) => { console.log(`[dev call] ${from} -> ${to}`); return { ref: 'dev' } },
  webrtcToken: async (clientName) => ({ token: 'dev-token', clientName }),
}
const storage: RecordingStorage = {
  signedUrl: async () => 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
  remove: async () => undefined,
  upload: async () => undefined,
}

const app = await buildApp({ env, pool, fetchImpl: fetchImpl as never, provider, storage, push: null })
await app.listen({ port: env.PORT, host: '127.0.0.1' })
console.log('Dev API on http://127.0.0.1:8787 (in-memory Postgres, sample data). Sign in as agent@x.test, sup@x.test or admin@x.test, any password.')
