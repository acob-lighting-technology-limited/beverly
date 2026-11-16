/**
 * LOCAL DEVELOPMENT ONLY. Runs the real API against an in-memory Postgres (PGlite) with the real migrations applied,
 * a stubbed Beverly sign-on and sample data, including Beverly's customers, meters, staff, wallets and purchases in the
 * same tables the read-only views sit on. Refuses to start in production. Never deploy this entry point.
 *
 * Sign in with any password. The email prefix picks the role: agent@..., sup@..., admin@...
 * No notifications are seeded: the bell only ever shows what the app itself raises from real events.
 */
import { createHash } from 'node:crypto'
import { buildApp } from '../app.js'
import { loadEnv } from '../config/env.js'
import { createCallCentreDb } from './pglite-pool.js'
import type { CommunicationsProvider } from '../telephony/provider.js'
import type { RecordingStorage } from '../storage/recording-storage.js'

if (process.env.NODE_ENV === 'production') throw new Error('dev-server must not run in production')

const env = loadEnv({
  NODE_ENV: 'development', PORT: process.env.MOCK_PORT ?? '8787', DATABASE_URL: 'postgres://dev:dev@localhost:5432/dev',
  BEVERLY_AUTH_URL: 'https://beverly.dev.test', BEVERLY_AUTH_ANON_KEY: 'dev', BEVERLY_API_URL: 'https://beverly.dev.test',
  SESSION_SECRET: 'dev-only-secret-dev-only-secret-dev-only', ALLOWED_ORIGIN: process.env.MOCK_ORIGIN ?? 'http://127.0.0.1:5173',
  AT_WEBHOOK_SECRET: 'dev-webhook-secret-1234', AT_VIRTUAL_NUMBER: '+2347000000000', LOGIN_RATE_LIMIT: '200', BEVERLY_READ_MODE: 'db',
})

/** Deterministic UUID per name (hashed, so similar names never collide). */
const uid = (name: string): string => `00000000-0000-4000-8000-${createHash('sha1').update(name).digest('hex').slice(0, 12)}`
const SEED_AGENTS = [['chidi', 'Chidi Okafor', ['en', 'ig'], 'available'], ['tunde', 'Tunde Ade', ['en', 'yo', 'pcm'], 'acw'], ['ngozi', 'Ngozi Eze', ['en', 'ig'], 'available'], ['ibrahim', 'Ibrahim Sani', ['en', 'ha'], 'break'], ['sade', 'Sade Ola', ['en', 'yo'], 'busy']] as const

const { pool } = await createCallCentreDb()
const MUSA = uid('cust-musa'); const NGOZI = uid('cust-ngozi'); const TOPE = uid('cust-tope')

/* ---- Beverly's data (the tables the call_centre_read views sit on) ---- */
await pool.query(`insert into public.customers (id, full_name, phone, email, status, vend_pin_hash, kyc_data) values
  ($1,'Musa Garba','08035550142','musa@example.test','active','not-exposed','{"bvn":"hidden"}'),
  ($2,'Ngozi Obi','+2347065550188',null,'active',null,null), ($3,'Tope Bello','09025550121',null,'active',null,null)`, [MUSA, NGOZI, TOPE])
await pool.query(`insert into public.customer_meters (customer_id, meter_id, station_id, status) values
  ($1,'4201 8837 112','KANO NORTH','approved'), ($2,'4201 7710 306','ENUGU EAST','approved'), ($3,'4188 2043 771','IKEJA','approved')`, [MUSA, NGOZI, TOPE])
for (const [i, [c, bal, hold]] of [[MUSA, 320000, 20000], [NGOZI, 840000, 0], [TOPE, 40000, 0]].entries()) {
  await pool.query(`insert into public.wallets (id, owner_type, owner_id) values ($1,'customer',$2)`, [uid(`wallet-${i}`), c])
  await pool.query(`insert into public.wallet_balances_stub values ($1,$2,$3,$4)`, [uid(`wallet-${i}`), bal, hold, Number(bal) - Number(hold)])
}
await pool.query(`insert into public.purchase_orders (actor_type, actor_id, customer_id, meter_id, station_id, amount_minor, status, token, created_at) values
  ('customer',$1::uuid,$1::text,'4201 8837 112','KANO NORTH',500000,'delivered','3891 2207 5561 0000 4455', now() - interval '1 day'),
  ('customer',$1::uuid,$1::text,'4201 8837 112','KANO NORTH',300000,'delivered','1122 3344 5566 7788 9900', now() - interval '3 days')`, [MUSA])
const STATIONS = ['KANO NORTH', 'ENUGU EAST', 'IKEJA']
await pool.query(`insert into public.users (auth_user_id, user_name, email, role_key, station_ids, portal_access) values
  ($1,'agent','agent@x.test','custom-call-centre-agent',$5::text[],'{call}'), ($2,'sup','sup@x.test','custom-call-centre-supervisor',$5::text[],'{call}'),
  ($3,'admin','admin@x.test','super-admin',null,'{call,crm}'), ($4,'Chidi Okafor','chidi@x.test','custom-call-centre-agent',$5::text[],'{call}')`, [uid('agent'), uid('sup'), uid('admin'), uid('chidi'), STATIONS])

/* ---- Call-centre sample data (real tables, real SQL) ---- */
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
  ('EX-2041',$3,'wallet_debited_no_token','HIGH',$1, now() + interval '3 hours','OPEN',5000,'0803 555 0142'),
  ('EX-2040',$4,'token_not_received','MEDIUM',$2, now() + interval '5 hours','INVESTIGATING',3000,'0706 555 0188'),
  ('EX-2039',$5,'wrong_meter_credited','MEDIUM',$1, now() + interval '8 hours','OPEN',2000,'0902 555 0121')`, [uid('chidi'), uid('tunde'), MUSA, NGOZI, TOPE])
await pool.query(`insert into call_centre.callbacks (callback_ref, phone_number, language, reason, scheduled_for) values
  ('CB-DEMO1','0902 555 0121','yo','Meter query', now() + interval '2 hours'), ('CB-DEMO2','0813 555 0199','ha','Token not received', now() + interval '4 hours')`)
await pool.query(`insert into call_centre.recordings (call_id, storage_key, storage_bucket, duration_seconds, expires_at, ingested_at)
  select id, 'calls/' || at_session_id || '.mp3', 'call-recordings', 150, now() + interval '80 days', now() from call_centre.calls where at_session_id like 'seed-%' order by started_at desc limit 6`)
await pool.query(`update call_centre.recordings set legal_hold = true where id = (select id from call_centre.recordings limit 1)`)
// A live call for the dev agent so the call screen has something to show.
await pool.query(`insert into call_centre.calls (at_session_id, direction, caller_number, queue, agent_crm_id, started_at, answered_at) values ('seed-live','inbound','+2348035550142','general',$1, now() - interval '2 minutes', now() - interval '2 minutes')`, [uid('agent')])
await pool.query(`insert into call_centre.agent_presence (agent_crm_id, name, client_name, status, languages) values ($1,'agent','cc.agent','busy','{en,ha}')`, [uid('agent')])
setInterval(() => { void pool.query(`update call_centre.agent_presence set last_seen = now() where agent_crm_id = any($1::text[])`, [SEED_AGENTS.map((a) => uid(a[0]))]) }, 30_000)

/* ---- stubbed Beverly sign-on, carrier and storage ---- */
/** Beverly support tickets as its admin API returns them. In memory, so replies and status changes can be tried. */
const TICKET = uid('tkt-1'); const TICKET2 = uid('tkt-2')
const tickets: Record<string, any>[] = [
  { id: TICKET, reference: 'TKT-2026-00001', subject: 'Paid for electricity but no token', category: 'vending', priority: 'high', status: 'open', requester_actor_type: 'customer', requester_name: 'Musa Garba', customer_id: MUSA, assigned_to_user_id: null, last_message_at: new Date(Date.now() - 36e5).toISOString(), created_at: new Date(Date.now() - 72e5).toISOString(), meter_context: { meter_id: '4201 8837 112' } },
  { id: TICKET2, reference: 'TKT-2026-00002', subject: 'How do I link a second meter?', category: 'account', priority: 'normal', status: 'awaiting_customer', requester_actor_type: 'customer', requester_name: 'Ngozi Obi', customer_id: NGOZI, assigned_to_user_id: null, last_message_at: new Date(Date.now() - 864e5).toISOString(), created_at: new Date(Date.now() - 2 * 864e5).toISOString(), meter_context: null },
]
const messages: Record<string, any>[] = [
  { id: uid('m1'), ticket_id: TICKET, sender_actor_type: 'customer', sender_name: 'Musa Garba', body: 'I paid NGN 5,000 this morning and no token came.', is_internal: false, created_at: new Date(Date.now() - 72e5).toISOString() },
  { id: uid('m2'), ticket_id: TICKET2, sender_actor_type: 'customer', sender_name: 'Ngozi Obi', body: 'How do I link a second meter?', is_internal: false, created_at: new Date(Date.now() - 2 * 864e5).toISOString() },
]
const names = new Map<string, string>()
const ROLE_KEY = (n: string) => (n.startsWith('agent') ? 'custom-call-centre-agent' : n.startsWith('sup') ? 'custom-call-centre-supervisor' : 'super-admin')
const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
  const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 })
  if (url.includes('/auth/v1/token')) { const n = String((JSON.parse(String(init?.body)) as { email: string }).email).split('@')[0]!; names.set(uid(n), n); return json({ access_token: `dev-${n}`, user: { id: uid(n), user_metadata: { full_name: n } } }) }
  if (url.includes('/auth/v1/health')) return json({ ok: true })
  const sup = /admin\/support\/tickets(?:\/([^/?]+))?(\/messages)?/.exec(url)
  if (sup) {
    const method = init?.method ?? 'GET'
    if (sup[1] === 'stats') { const n = (st: string) => tickets.filter((t) => t.status === st).length; return json({ total: tickets.length, open: n('open'), pending: n('pending'), awaiting_customer: n('awaiting_customer'), resolved: n('resolved'), closed: n('closed') }) }
    if (!sup[1]) { const st = /[?&]status=([^&]*)/.exec(url)?.[1]; const mine = /[?&]assigned=me/.test(url); return json({ tickets: tickets.filter((t) => (!st || t.status === st) && (!mine || t.assigned_to_user_id)) }) }
    const t = tickets.find((x) => x.id === sup[1])
    if (!t) return new Response('{}', { status: 404 })
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {}
    if (method === 'PATCH') { if (body.status) t.status = body.status; if (body.priority) t.priority = body.priority; if (body.assign_to_me) t.assigned_to_user_id = uid('agent'); if (body.unassign) t.assigned_to_user_id = null; t.last_message_at = new Date().toISOString(); return json({ ok: true }) }
    if (method === 'POST' && sup[2]) { messages.push({ id: uid(`m${messages.length + 1}`), ticket_id: t.id, sender_actor_type: 'staff', sender_name: 'Support', body: String(body.body), is_internal: Boolean(body.internal), created_at: new Date().toISOString() }); t.last_message_at = new Date().toISOString(); return json({ ok: true }) }
    return json({ ...t, support_ticket_messages: messages.filter((m) => m.ticket_id === t.id) })
  }
  if (url.includes('/rest/v1/users')) { const n = names.get(/auth_user_id=eq\.([^&]+)/.exec(url)?.[1] ?? '') ?? ''; return json([{ role_key: ROLE_KEY(n), portal_access: ['call'] }]) }
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
console.log(`Dev API on http://127.0.0.1:${env.PORT} (in-memory Postgres, sample data, Beverly data read through the views). Sign in as agent@x.test, sup@x.test or admin@x.test, any password.`)
