import { beforeAll, describe, expect, it } from 'vitest'
import { A1, A2, boot, hook, uid, type Harness } from './helpers.js'

/** Reads Beverly's data through the call_centre_read views, with Beverly's station scoping. */
let h: Harness
const C1 = uid('cust-musa')      // Kano North, has a wallet and a purchase with a token
const C2 = uid('cust-tope')      // Ikeja
const C3 = uid('cust-ade')       // Lagos, nobody here is assigned there
const P1 = uid('purchase-1')
const TOKEN = '3891 2207 5561 0000 4455'

beforeAll(async () => {
  h = await boot({ BEVERLY_READ_MODE: 'db' })
  const q = (s: string, p: unknown[] = []) => h.pool.query(s, p)
  await q(`insert into public.customers (id, full_name, name, phone, email, vend_pin_hash, vend_pin_salt, kyc_data, raw_payload) values
    ($1,'Musa Garba',null,'0803 555 0142','musa@x.test','HASH','SALT','{"bvn":"123"}','{"x":1}'),
    ($2,null,'Tope Bello','+2349025550121',null,null,null,null,null),
    ($3,'Ade Ola','Ade','08055550133',null,null,null,null,null)`, [C1, C2, C3])
  await q(`insert into public.customer_meters (customer_id, meter_id, station_id, status) values
    ($1,'4201 8837 112','KANO NORTH','approved'), ($1,'9999 0000 111','KANO NORTH','pending'), ($2,'4188 2043 771','IKEJA','pending'), ($3,'7777 1111 222','LAGOS','approved')`, [C1, C2, C3])
  await q(`insert into public.users (auth_user_id, user_name, email, role_key, station_ids, portal_access) values
    ($1,'Aisha Bello','aisha@x.test','custom-call-centre-agent','{kano north}','{call}'),
    ($2,'No Station','nostation@x.test','custom-call-centre-agent',null,'{call}'),
    ($3,'Sup One','sup@x.test','custom-call-centre-supervisor','{KANO NORTH,IKEJA}','{call}'),
    ($4,'Crm Only','crm@x.test','super-admin',null,'{crm}')`, [A1, A2, uid('sup1'), uid('crm')])
  await q(`insert into public.wallets (id, owner_type, owner_id) values ($1,'customer',$2)`, [uid('wallet-1'), C1])
  await q(`insert into public.wallet_balances_stub values ($1, 320000, 20000, 300000)`, [uid('wallet-1')])
  await q(`insert into public.purchase_orders (id, actor_type, actor_id, customer_id, meter_id, station_id, amount_minor, status, token) values
    ($1,'customer',$2::uuid,$2::text,'4201 8837 112','KANO NORTH',500000,'delivered',$3)`, [P1, C1, TOKEN])
})

describe('customers, scoped to the agent’s stations', () => {
  it('finds a customer by name, meter, email or a phone typed in any format', async () => {
    const a = await h.as('agent1@x.test')
    for (const q of ['musa', '8837', 'musa@x.test', '8035550142', '+234 803 555 0142']) {
      const r = await h.get(`/api/customers?q=${encodeURIComponent(q)}`, a)
      expect(r.json.map((c: { id: string }) => c.id), q).toEqual([C1])
    }
  })

  it('returns the wallet balance in naira, the first approved meter and the stations', async () => {
    const a = await h.as('agent1@x.test')
    expect((await h.get('/api/customers?q=musa', a)).json[0]).toMatchObject({ name: 'Musa Garba', meter: '4201 8837 112', balance: 3200, area: 'KANO NORTH', accountType: 'Prepaid' })
  })

  it('hides customers at other stations, matches station names case-insensitively, and treats like-wildcards as text', async () => {
    const a = await h.as('agent1@x.test')   // assigned "kano north" in lower case
    expect((await h.get('/api/customers?q=', a)).json.map((c: { id: string }) => c.id)).toEqual([C1])
    expect((await h.get('/api/customers?q=%25', a)).json).toEqual([])
    expect((await h.get('/api/customers?q=ade', a)).json).toEqual([])
  })

  it('supervisors see their stations, admins see everything, and no station means no access', async () => {
    const sup = await h.as('sup1@x.test'); const adm = await h.as('admin1@x.test'); const none = await h.as('agent2@x.test')
    expect((await h.get('/api/customers?q=', sup)).json.map((c: { id: string }) => c.id).sort()).toEqual([C1, C2].sort())
    expect((await h.get('/api/customers?q=', adm)).json).toHaveLength(3)
    const r = await h.get('/api/customers?q=', none)
    expect(r.status).toBe(403)
    expect(r.json.error).toContain('station')
  })

  it('falls back to the name column when full_name is empty', async () => {
    const sup = await h.as('sup1@x.test')
    expect((await h.get('/api/customers?q=tope', sup)).json[0].name).toBe('Tope Bello')
  })
})

describe('purchases and the raw token', () => {
  it('shows only the last four token digits, never the token', async () => {
    const a = await h.as('agent1@x.test')
    const d = (await h.get(`/api/customers/${C1}/detail`, a)).json
    expect(d.meters).toEqual(['4201 8837 112', '9999 0000 111'])
    expect(d.purchases[0]).toMatchObject({ id: P1, amount: 5000, status: 'delivered', tokenMasked: '•••• •••• •••• 4455' })
    expect(JSON.stringify(d)).not.toContain('3891')
  })

  it('releases the token only to someone in scope, for that customer, after audit', async () => {
    const a = await h.as('agent1@x.test'); const none = await h.as('agent2@x.test'); const sup = await h.as('sup1@x.test')
    const body = { purchaseId: P1, verified: { name: true, meter: true, lastVend: true }, reason: 'Customer asked for the token' }
    expect((await h.send('POST', `/api/customers/${C2}/token-reveal`, sup, body)).status).toBe(404)   // purchase belongs to C1
    expect((await h.send('POST', `/api/customers/${C1}/token-reveal`, none, body)).status).toBe(403)  // no station
    expect((await h.pool.query(`select 1 from call_centre.audit_log where action = 'token.reveal'`)).rowCount).toBe(0)
    expect((await h.send('POST', `/api/customers/${C1}/token-reveal`, a, body)).json).toEqual({ token: TOKEN })
    expect((await h.pool.query(`select 1 from call_centre.audit_log where action = 'token.reveal'`)).rowCount).toBe(1)
  })

  it('refuses ids that are not uuids instead of erroring', async () => {
    const a = await h.as('agent1@x.test')
    expect((await h.get('/api/customers/not-a-uuid/detail', a)).json).toMatchObject({ meters: [], purchases: [] })
  })
})

describe('calls and staff use the same source', () => {
  it('matches an incoming caller to the customer, with meter and balance', async () => {
    const a = await h.as('agent1@x.test')
    await h.send('PUT', '/api/presence', a, { status: 'available', languages: ['en'] })
    const ev = { sessionId: 'DB1', isActive: '1', callerNumber: '+2348035550142', direction: 'inbound' }
    await hook(h, '/api/webhooks/at/voice', ev); await hook(h, '/api/webhooks/at/voice', { ...ev, dtmfDigits: '1' })
    expect((await h.get('/api/calls/active', a)).json).toMatchObject({ name: 'Musa Garba', customer: { id: C1, meter: '4201 8837 112', balance: 3200 } })
  })

  it('lists staff with call access from the staff view and names agents on cases', async () => {
    const adm = await h.as('admin1@x.test')
    const users = (await h.get('/api/admin/users', adm)).json as { name: string }[]
    expect(users.map((u) => u.name).sort()).toEqual(['Aisha Bello', 'No Station', 'Sup One'])
  })
})

describe('wallets and roles', () => {
  it('shows balance, holds and available funds in naira, only for customers in the agent’s stations', async () => {
    const a = await h.as('agent1@x.test'); const sup = await h.as('sup1@x.test')
    expect((await h.get(`/api/customers/${C1}/wallet`, a)).json).toEqual({ status: 'active', currency: 'NGN', balance: 3200, holds: 200, available: 3000 })
    expect((await h.get(`/api/customers/${C3}/wallet`, a)).status).toBe(404)        // Lagos customer, not agent1’s station
    expect((await h.get(`/api/customers/${C2}/wallet`, sup)).status).toBe(404)      // in scope but has no wallet
    expect((await h.get('/api/customers/not-a-uuid/wallet', a)).status).toBe(404)
  })

  it('lists roles with how many staff hold each and how many permissions they carry', async () => {
    const adm = await h.as('admin1@x.test'); const a = await h.as('agent1@x.test')
    const roles = (await h.get('/api/admin/roles', adm)).json as { roleKey: string; label: string; people: number; permissions: number }[]
    expect(roles.find((r) => r.roleKey === 'custom-call-centre-agent')).toMatchObject({ label: 'Call Centre Agent', people: 2, permissions: 3 })
    expect(roles.find((r) => r.roleKey === 'custom-call-centre-supervisor')).toMatchObject({ people: 1, permissions: 3 })
    expect((await h.get('/api/admin/roles', a)).status).toBe(403)
  })

  it('puts each person’s role label on the staff list', async () => {
    const adm = await h.as('admin1@x.test')
    const users = (await h.get('/api/admin/users', adm)).json as { name: string; roleLabel: string | null }[]
    expect(users.find((u) => u.name === 'Aisha Bello')?.roleLabel).toBe('Call Centre Agent')
  })
})

describe('what the views expose', () => {
  it('never include PIN hashes, KYC data, raw payloads, session ids or the token', async () => {
    const r = await h.pool.query<{ column_name: string }>(`select column_name from information_schema.columns where table_schema = 'call_centre_read'`)
    const cols = r.rows.map((x) => x.column_name)
    for (const banned of ['vend_pin_hash', 'vend_pin_salt', 'kyc_data', 'raw_payload', 'password_session_id', 'token', 'idempotency_key', 'notification_preferences']) expect(cols, banned).not.toContain(banned)
    expect(cols).toEqual(expect.arrayContaining(['full_name', 'meter_id', 'portal_access', 'ledger_balance_minor', 'token_last4']))
  })

  it('give the restricted role the views and the one function, and nothing on public', async () => {
    const can = async (sql: string) => (await h.pool.query<{ ok: boolean }>(sql)).rows[0]!.ok
    for (const v of ['customers', 'customer_meters', 'staff', 'roles', 'role_permissions', 'wallets', 'purchases']) {
      expect(await can(`select has_table_privilege('beverly_call_api','call_centre_read.${v}','select') ok`), v).toBe(true)
      expect(await can(`select has_table_privilege('beverly_call_api','call_centre_read.${v}','insert') ok`), `${v} insert`).toBe(false)
    }
    expect(await can(`select has_function_privilege('beverly_call_api','call_centre_read.reveal_purchase_token(uuid)','execute') ok`)).toBe(true)
    for (const t of ['customers', 'users', 'wallets', 'purchase_orders', 'roles', 'permissions', 'customer_meters']) expect(await can(`select has_table_privilege('beverly_call_api','public.${t}','select') ok`), `public.${t}`).toBe(false)
    for (const role of ['anon', 'authenticated', 'public']) expect(await can(`select has_function_privilege('${role}','call_centre_read.reveal_purchase_token(uuid)','execute') ok`), role).toBe(false)
  })
})
