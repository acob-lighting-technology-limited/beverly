import { z } from 'zod'
import type { Customer } from '@beverly-call/shared'
import type { Env } from '../config/env.js'
import type { FetchLike } from './beverly-auth.js'

export class BeverlyError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

/**
 * Beverly's admin API, read-only, called with the agent's own bearer token so Beverly's role permissions and
 * station scoping apply. Shapes below come from backend/wallet/src/routes/admin.ts in the Beverly repo:
 *   GET /customers?q&limit            -> { customers: [{ id, full_name, phone, email, status, balance_minor, available_minor, station_ids }], nextCursor }
 *   GET /customers/:id/meters         -> { meters: [{ meter_id, status, station_id, nickname }] }
 *   GET /customers/:id/purchases      -> { purchases: [purchase_orders rows: id, amount_minor, status, token, created_at, meter_id] }
 *   GET /access/staff-status          -> { staff: [{ auth_user_id, user_name, email, role_key, portal_access, last_sign_in_at, suspended }] }
 * Money is in minor units (kobo): divide by 100 for naira. Search matches name, phone or email only (not meter number).
 */
const beverlyCustomer = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  full_name: z.string().nullish().transform((v) => v ?? ''),
  phone: z.string().nullish().transform((v) => v ?? ''),
  balance_minor: z.number().nullish().transform((v) => v ?? null),
  station_ids: z.array(z.string()).nullish().transform((v) => v ?? []),
}).passthrough()
const customerList = z.object({ customers: z.array(beverlyCustomer) })

const meterList = z.object({ meters: z.array(z.object({ meter_id: z.string().nullish(), status: z.string().nullish() }).passthrough()) })

const toCustomer = (c: z.infer<typeof beverlyCustomer>): Customer => ({
  id: c.id, name: c.full_name, meter: '', phone: c.phone, area: c.station_ids.join(', '),
  // Beverly customers all have a wallet. TODO(debt): postpaid accounts are not modelled in Beverly yet.
  accountType: 'Prepaid', balance: c.balance_minor === null ? null : c.balance_minor / 100,
})

async function get(env: Env, token: string, path: string, f: FetchLike): Promise<unknown> {
  const r = await f(`${env.BEVERLY_API_URL}${path}`, { headers: { authorization: `Bearer ${token}` } })
  if (r.status === 401 || r.status === 403) throw new BeverlyError(r.status, 'Beverly refused this lookup')
  if (!r.ok) throw new BeverlyError(502, 'Beverly is unavailable')
  return r.json()
}

export async function fetchCustomers(env: Env, token: string, q: string, f: FetchLike = fetch, limit = 50): Promise<Customer[]> {
  const parsed = customerList.safeParse(await get(env, token, `/api/v1/admin/customers?q=${encodeURIComponent(q.slice(0, 64))}&limit=${limit}`, f))
  if (!parsed.success) throw new BeverlyError(502, 'Unexpected customer response')
  return parsed.data.customers.map(toCustomer)
}

/** The customer's meter numbers (approved links first). Empty when Beverly refuses or has none. */
export async function fetchMeters(env: Env, token: string, customerId: string, f: FetchLike = fetch): Promise<string[]> {
  const parsed = meterList.safeParse(await get(env, token, `/api/v1/admin/customers/${encodeURIComponent(customerId)}/meters`, f))
  if (!parsed.success) throw new BeverlyError(502, 'Unexpected meter response')
  const rows = parsed.data.meters.filter((m) => m.meter_id)
  rows.sort((a, b) => Number(b.status === 'approved') - Number(a.status === 'approved'))
  return rows.map((m) => String(m.meter_id))
}

export async function fetchPurchases(env: Env, token: string, customerId: string, f: FetchLike = fetch): Promise<Record<string, unknown>[]> {
  const raw = (await get(env, token, `/api/v1/admin/customers/${encodeURIComponent(customerId)}/purchases?limit=10`, f)) as { purchases?: Record<string, unknown>[] }
  return Array.isArray(raw.purchases) ? raw.purchases : []
}

/** Last ten digits of a phone, which matches +234803..., 0803... and spaced formats alike. */
export const phoneTail = (p: string): string => p.replace(/\D/g, '').slice(-10)
