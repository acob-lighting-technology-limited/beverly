import { z } from 'zod'
import type { Customer } from '@beverly-call/shared'
import type { Env } from '../config/env.js'
import type { FetchLike } from './beverly-auth.js'

export class BeverlyError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

/**
 * Beverly's customer record, read-only. TODO(debt): field names are assumed from the Beverly admin API
 * (GET /api/v1/admin/customers); confirm against backend/wallet/src/routes and adjust this one mapper.
 */
const beverlyCustomer = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  name: z.string().default(''), meter_number: z.string().default(''), phone: z.string().default(''),
  area: z.string().default(''), account_type: z.string().default('Prepaid'), wallet_balance: z.number().nullable().default(null),
}).passthrough()
const beverlyList = z.object({ data: z.array(beverlyCustomer) }).or(z.array(beverlyCustomer).transform((data) => ({ data })))

const toCustomer = (c: z.infer<typeof beverlyCustomer>): Customer =>
  ({ id: c.id, name: c.name, meter: c.meter_number, phone: c.phone, area: c.area, accountType: c.account_type, balance: c.wallet_balance })

async function get(env: Env, token: string, path: string, f: FetchLike): Promise<unknown> {
  // The agent's own bearer token is used, so Beverly's role permissions decide what is visible.
  const r = await f(`${env.BEVERLY_API_URL}${path}`, { headers: { authorization: `Bearer ${token}` } })
  if (r.status === 401 || r.status === 403) throw new BeverlyError(r.status, 'Beverly refused this lookup')
  if (!r.ok) throw new BeverlyError(502, 'Beverly is unavailable')
  return r.json()
}

export async function fetchCustomers(env: Env, token: string, q: string, f: FetchLike = fetch, limit = 50): Promise<Customer[]> {
  const parsed = beverlyList.safeParse(await get(env, token, `/api/v1/admin/customers?search=${encodeURIComponent(q.slice(0, 64))}&limit=${limit}`, f))
  if (!parsed.success) throw new BeverlyError(502, 'Unexpected customer response')
  return parsed.data.data.map(toCustomer)
}

export async function fetchPurchases(env: Env, token: string, customerId: string, f: FetchLike = fetch): Promise<Record<string, unknown>[]> {
  const raw = (await get(env, token, `/api/v1/admin/customers/${encodeURIComponent(customerId)}/purchases?limit=10`, f)) as { data?: Record<string, unknown>[] } | Record<string, unknown>[]
  return Array.isArray(raw) ? raw : raw.data ?? []
}

/** Digits only, last nine, so 0803 555 0142 and +234 803 555 0142 compare equal. */
export const phoneTail = (p: string): string => p.replace(/\D/g, '').slice(-9)
