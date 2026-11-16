import type { Pool } from 'pg'
import type { Customer, Role, RoleSummary, WalletInfo } from '@beverly-call/shared'
import { BeverlyError } from './beverly-api.js'
import type { BeverlyStaff } from './staff-directory.js'

/**
 * Reads Beverly's data straight from the shared database through the read-only views in `call_centre_read`
 * (migration 20261116120000). Only an explicit column list is exposed; the raw STS token is reachable one purchase at a
 * time through reveal_purchase_token(). Beverly's API enforces station scoping on these reads, so this does too:
 * admins see everything; everyone else sees only customers with a meter at one of their assigned stations.
 */
export interface Actor { id: string; role: Role }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Stations the actor may read, or null for no restriction. No assigned station is refused, as Beverly's own routes do. */
export async function stationScope(pool: Pool, actor: Actor): Promise<string[] | null> {
  if (actor.role === 'admin') return null
  if (!UUID.test(actor.id)) throw new BeverlyError(403, 'No station is assigned to you in Beverly')
  const r = await pool.query<{ station_id: string | null; station_ids: string[] | null }>(
    'select station_id, station_ids from call_centre_read.staff where auth_user_id = $1 limit 1', [actor.id])
  const row = r.rows[0]
  const set = new Set<string>()
  for (const s of [row?.station_id, ...(row?.station_ids ?? [])]) if (s && s.trim()) set.add(s.trim().toUpperCase())
  if (!set.size) throw new BeverlyError(403, 'No station is assigned to you in Beverly')
  return [...set]
}

const escapeLike = (s: string): string => s.replace(/[\\%_]/g, (c) => `\\${c}`)

interface CustomerRow { id: string; full_name: string | null; phone: string | null; ledger_balance_minor: string | null; stations: string[] | null; meter: string | null }

export async function fetchCustomersDb(pool: Pool, actor: Actor, q: string, limit = 50): Promise<Customer[]> {
  const scope = await stationScope(pool, actor)
  const term = q.trim().slice(0, 64)
  const like = term ? `%${escapeLike(term)}%` : null
  const digits = term.replace(/\D/g, '')
  const digitLike = digits.length >= 7 ? `%${digits.slice(-10)}%` : null
  const r = await pool.query<CustomerRow>(
    `select c.id, c.full_name, c.phone, w.ledger_balance_minor,
            (select array_agg(distinct upper(m.station_id)) filter (where m.station_id is not null) from call_centre_read.customer_meters m where m.customer_id = c.id) as stations,
            (select m.meter_id from call_centre_read.customer_meters m where m.customer_id = c.id order by (m.status = 'approved') desc, m.created_at limit 1) as meter
     from call_centre_read.customers c
     left join call_centre_read.wallets w on w.owner_type = 'customer' and w.owner_id = c.id
     where ($1::text is null
            or c.full_name ilike $1 or c.phone ilike $1 or c.email ilike $1
            or ($2::text is not null and regexp_replace(coalesce(c.phone, ''), '\\D', '', 'g') like $2)
            or exists (select 1 from call_centre_read.customer_meters m where m.customer_id = c.id and m.meter_id ilike $1))
       and ($3::text[] is null or exists (select 1 from call_centre_read.customer_meters m where m.customer_id = c.id and upper(m.station_id) = any($3)))
     order by c.created_at desc
     limit $4`, [like, digitLike, scope, Math.min(limit, 200)])
  return r.rows.map((x) => ({
    id: x.id, name: x.full_name ?? '', meter: x.meter ?? '', phone: x.phone ?? '', area: (x.stations ?? []).join(', '),
    // TODO(debt): postpaid accounts are not modelled in Beverly yet; every customer has a prepaid wallet.
    accountType: 'Prepaid', balance: x.ledger_balance_minor === null ? null : Number(x.ledger_balance_minor) / 100,
  }))
}

/** The customer's meter numbers inside the actor's stations, approved links first. */
export async function fetchMetersDb(pool: Pool, actor: Actor, customerId: string): Promise<string[]> {
  if (!UUID.test(customerId)) return []
  const scope = await stationScope(pool, actor)
  const r = await pool.query<{ meter_id: string }>(
    `select meter_id from call_centre_read.customer_meters
     where customer_id = $1 and meter_id is not null and ($2::text[] is null or upper(station_id) = any($2))
     order by (status = 'approved') desc, created_at`, [customerId, scope])
  return r.rows.map((x) => x.meter_id)
}

/** Recent purchases for a customer. The token is never selected here; only its last four digits. */
export async function fetchPurchasesDb(pool: Pool, actor: Actor, customerId: string, limit = 10): Promise<Record<string, unknown>[]> {
  if (!UUID.test(customerId)) return []
  const scope = await stationScope(pool, actor)
  const r = await pool.query(
    `select id, created_at, amount_minor, status, token_last4, meter_id
     from call_centre_read.purchases
     where actor_type = 'customer' and actor_id = $1 and ($2::text[] is null or upper(station_id) = any($2))
     order by created_at desc, id desc limit $3`, [customerId, scope, Math.min(limit, 50)])
  return r.rows as Record<string, unknown>[]
}

/** One purchase's raw token, only if it belongs to this customer and sits inside the actor's stations. */
export async function revealTokenDb(pool: Pool, actor: Actor, customerId: string, purchaseId: string): Promise<string | null> {
  if (!UUID.test(customerId) || !UUID.test(purchaseId)) return null
  const scope = await stationScope(pool, actor)
  const own = await pool.query(
    `select 1 from call_centre_read.purchases
     where id = $1 and actor_type = 'customer' and actor_id = $2 and has_token and ($3::text[] is null or upper(station_id) = any($3))`, [purchaseId, customerId, scope])
  if (!own.rowCount) return null
  const r = await pool.query<{ t: string | null }>('select call_centre_read.reveal_purchase_token($1) as t', [purchaseId])
  return r.rows[0]?.t ?? null
}

/** Wallet balances for a customer the actor may see (same station scope as meters). Money in naira. */
export async function fetchWalletDb(pool: Pool, actor: Actor, customerId: string): Promise<WalletInfo | null> {
  if (!UUID.test(customerId)) return null
  const scope = await stationScope(pool, actor)
  if (scope) {
    const seen = await pool.query('select 1 from call_centre_read.customer_meters where customer_id = $1 and upper(station_id) = any($2) limit 1', [customerId, scope])
    if (!seen.rowCount) return null
  }
  const r = await pool.query<{ status: string; currency: string; ledger_balance_minor: string | null; active_holds_minor: string | null; available_balance_minor: string | null }>(
    "select status, currency, ledger_balance_minor, active_holds_minor, available_balance_minor from call_centre_read.wallets where owner_type = 'customer' and owner_id = $1 limit 1", [customerId])
  const w = r.rows[0]
  if (!w) return null
  return { status: w.status, currency: w.currency, balance: Number(w.ledger_balance_minor ?? 0) / 100, holds: Number(w.active_holds_minor ?? 0) / 100, available: Number(w.available_balance_minor ?? 0) / 100 }
}

/** Every role with how many staff hold it and how many permissions it carries. */
export async function fetchRolesDb(pool: Pool): Promise<RoleSummary[]> {
  const r = await pool.query<{ role_key: string; label: string | null; role_name: string | null; description: string | null; people: string; permissions: string }>(
    `select r.role_key, r.label, r.role_name, r.description,
            (select count(*) from call_centre_read.staff s where s.role_key = r.role_key) as people,
            (select count(*) from call_centre_read.role_permissions p where p.role_key = r.role_key) as permissions
     from call_centre_read.roles r order by coalesce(r.label, r.role_name, r.role_key)`)
  return r.rows.map((x) => ({ roleKey: x.role_key, label: x.label ?? x.role_name ?? x.role_key, description: x.description, people: Number(x.people), permissions: Number(x.permissions) }))
}

/** Staff with their role label, in the shape the staff directory uses. */
export async function fetchStaffDb(pool: Pool): Promise<(BeverlyStaff & { role_label: string | null })[]> {
  const r = await pool.query<{ id: string; auth_user_id: string | null; user_name: string | null; email: string | null; role_key: string | null; portal_access: string[] | null; role_label: string | null }>(
    `select s.id, s.auth_user_id, s.user_name, s.email, s.role_key, s.portal_access, coalesce(r.label, r.role_name) as role_label
     from call_centre_read.staff s left join call_centre_read.roles r on r.role_key = s.role_key order by s.user_name`)
  return r.rows.map((x) => ({ id: x.id, auth_user_id: x.auth_user_id, user_name: x.user_name, email: x.email, role_key: x.role_key, portal_access: x.portal_access, role_label: x.role_label, last_sign_in_at: null, suspended: false }))
}
