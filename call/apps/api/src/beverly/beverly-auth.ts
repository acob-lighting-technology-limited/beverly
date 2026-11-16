import { z } from 'zod'
import type { Role, SessionUser } from '@beverly-call/shared'
import type { Pool } from 'pg'
import type { Env } from '../config/env.js'

const supabaseLogin = z.object({
  access_token: z.string().min(1),
  user: z.object({ id: z.string().min(1), user_metadata: z.record(z.unknown()).default({}) }),
})

/** The staff row in the shared Supabase project: public.users, keyed by auth_user_id. */
const staffRow = z.array(z.object({ role_key: z.string().nullable(), portal_access: z.array(z.string()).nullable() }))

/** Roles that are always mapped, whatever their permissions. */
const ROLE_MAP: Record<string, Role> = {
  'custom-call-centre-agent': 'agent',
  'custom-call-centre-supervisor': 'supervisor',
  'super-admin': 'admin',
}

/**
 * Beverly has many staff roles (operations officers and managers, account officers, finance, ...). Rather than a fixed list,
 * a role can work the call desk when Beverly itself lets it view customers AND manage support, the two permissions the
 * call-centre agent role is built from. Names containing "manager" or "supervisor" lead the desk; everyone else is an agent.
 * Roles without both permissions (account, finance, read-only, vendor, developer) stay out.
 */
export function callRoleFor(roleKey: string, permissions: readonly string[] | null): Role | undefined {
  const fixed = ROLE_MAP[roleKey]
  if (fixed) return fixed
  if (!permissions || !permissions.includes('wallet.support.manage') || !permissions.includes('wallet.customers.view')) return undefined
  return /manager|supervisor/i.test(roleKey) ? 'supervisor' : 'agent'
}

export class AuthError extends Error {
  /** `message` is safe to show the user; `reason` is for server logs only and never reaches the client. */
  constructor(public status: 401 | 403, message: string, public reason = message) { super(message) }
}

/** Reusable seam so tests can stub Beverly. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

/**
 * Signs a staff member in against the shared Supabase auth, then reads their own public.users row
 * (role_key, portal_access) with their own token, so Beverly's row-level security stays in charge.
 * Access needs portal_access to include `call` and a role we map.
 * TODO(debt): confirm RLS lets staff read their own users row. If not, ask Beverly for a "who am I"
 * admin endpoint and swap only this lookup.
 */
export async function signInStaff(env: Env, email: string, password: string, f: FetchLike = fetch, pool?: Pool): Promise<{ user: SessionUser; token: string }> {
  const r = await f(`${env.BEVERLY_AUTH_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: env.BEVERLY_AUTH_ANON_KEY },
    body: JSON.stringify({ email, password }),
  })
  if (!r.ok) throw new AuthError(401, 'Invalid credentials', `Beverly auth rejected the login (HTTP ${r.status})`)
  const parsed = supabaseLogin.safeParse(await r.json())
  if (!parsed.success) throw new AuthError(401, 'Invalid credentials', 'Beverly auth returned an unexpected login response')
  const { access_token: token, user } = parsed.data

  const p = await f(`${env.BEVERLY_AUTH_URL}/rest/v1/users?auth_user_id=eq.${encodeURIComponent(user.id)}&select=role_key,portal_access&limit=1`, {
    headers: { apikey: env.BEVERLY_AUTH_ANON_KEY, authorization: `Bearer ${token}` },
  })
  if (!p.ok) throw new Error(`Beverly profile lookup failed (${p.status})`)
  const row = staffRow.parse(await p.json())[0]
  const roleKey = row?.role_key ?? ''
  // Permissions come from the read-only role_permissions view when the database is reachable; otherwise only the fixed roles map.
  const perms = pool && !ROLE_MAP[roleKey] ? await pool.query<{ route_hash: string }>('select route_hash from call_centre_read.role_permissions where role_key = $1', [roleKey]).then((r) => r.rows.map((x) => x.route_hash)).catch(() => null) : null
  const role = callRoleFor(roleKey, perms)
  if (!row) throw new AuthError(403, 'No call centre access', 'no public.users row readable for this auth user (missing row, or row-level security)')
  if (!role) throw new AuthError(403, 'No call centre access', `role_key "${roleKey}" does not map to a Beverly Call role`)
  if (!row.portal_access?.includes('call')) throw new AuthError(403, 'No call centre access', `portal_access [${row.portal_access?.join(', ') ?? ''}] does not include "call"`)

  const fullName = user.user_metadata.full_name
  return { user: { id: user.id, name: typeof fullName === 'string' && fullName ? fullName : email, role }, token }
}
