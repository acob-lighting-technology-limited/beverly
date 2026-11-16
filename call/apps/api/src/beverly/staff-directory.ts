import { z } from 'zod'
import type { Env } from '../config/env.js'
import type { FetchLike } from './beverly-auth.js'

const staffList = z.object({ data: z.array(z.object({ id: z.union([z.string(), z.number()]).transform(String), auth_user_id: z.string().optional(), full_name: z.string().optional(), name: z.string().optional() })) })
  .or(z.array(z.object({ id: z.union([z.string(), z.number()]).transform(String), auth_user_id: z.string().optional(), full_name: z.string().optional(), name: z.string().optional() })).transform((data) => ({ data })))

const TTL_MS = 5 * 60 * 1000
let cache: { at: number; names: Map<string, string> } | null = null

/**
 * Resolves Beverly staff ids to display names, cached for five minutes. Falls back to an empty map
 * (callers then show the id) if Beverly refuses or the shape differs.
 * TODO(debt): endpoint and field names are assumed (GET /api/v1/admin/staff); confirm with the Beverly team.
 */
export async function staffNames(env: Env, token: string, f: FetchLike = fetch): Promise<Map<string, string>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.names
  try {
    const r = await f(`${env.BEVERLY_API_URL}/api/v1/admin/staff?limit=500`, { headers: { authorization: `Bearer ${token}` } })
    if (!r.ok) return new Map()
    const parsed = staffList.safeParse(await r.json())
    if (!parsed.success) return new Map()
    const names = new Map<string, string>()
    for (const s of parsed.data.data) {
      const n = s.full_name ?? s.name
      if (n) { names.set(s.id, n); if (s.auth_user_id) names.set(s.auth_user_id, n) }
    }
    cache = { at: Date.now(), names }
    return names
  } catch {
    return new Map()
  }
}

/** Test helper: forget the cache. */
export const resetStaffCache = (): void => { cache = null }
