import { z } from 'zod'
import type { Pool } from 'pg'
import type { Env } from '../config/env.js'
import type { FetchLike } from './beverly-auth.js'

const staffRow = z.object({
  auth_user_id: z.string().nullish(), id: z.union([z.string(), z.number()]).transform(String).optional(),
  user_name: z.string().nullish(), email: z.string().nullish(), role_key: z.string().nullish(),
  portal_access: z.array(z.string()).nullish(), last_sign_in_at: z.string().nullish(), suspended: z.boolean().nullish(),
}).passthrough()
export type BeverlyStaff = z.infer<typeof staffRow>
const staffList = z.object({ staff: z.array(staffRow) })

const TTL_MS = 5 * 60 * 1000
let cache: { at: number; rows: BeverlyStaff[] } | null = null

/**
 * Beverly's staff directory (GET /api/v1/admin/access/staff-status). Only staff who may manage access can read it, so
 * for most agents this returns an empty list; callers fall back to names Beverly Call itself has seen (presence).
 */
export async function fetchStaff(env: Env, token: string, f: FetchLike = fetch): Promise<BeverlyStaff[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rows
  try {
    const r = await f(`${env.BEVERLY_API_URL}/api/v1/admin/access/staff-status`, { headers: { authorization: `Bearer ${token}` } })
    if (!r.ok) return []
    const parsed = staffList.safeParse(await r.json())
    if (!parsed.success) return []
    cache = { at: Date.now(), rows: parsed.data.staff }
    return cache.rows
  } catch { return [] }
}

/** id -> display name: Beverly's directory when readable, plus every name this app has seen on the presence roster. */
export async function staffNames(env: Env, token: string, f: FetchLike = fetch, pool?: Pool): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  if (pool) {
    const p = await pool.query<{ agent_crm_id: string; name: string }>('select agent_crm_id, name from call_centre.agent_presence')
    for (const x of p.rows) names.set(x.agent_crm_id, x.name)
  }
  for (const s of await fetchStaff(env, token, f)) {
    const n = s.user_name ?? s.email
    if (!n) continue
    if (s.auth_user_id) names.set(s.auth_user_id, n)
    if (s.id) names.set(s.id, n)
  }
  return names
}

/** Test helper: forget the cache. */
export const resetStaffCache = (): void => { cache = null }
