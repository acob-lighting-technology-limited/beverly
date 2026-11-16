import { z } from 'zod'
import type { Role, SessionUser } from '@beverly-call/shared'
import type { Env } from '../config/env.js'

const supabaseLogin = z.object({
  access_token: z.string().min(1),
  user: z.object({ id: z.string().min(1), user_metadata: z.record(z.unknown()).default({}) }),
})

/** The staff row in the shared Supabase project: public.users, keyed by auth_user_id. */
const staffRow = z.array(z.object({ role_key: z.string().nullable(), portal_access: z.array(z.string()).nullable() }))

/** Beverly role keys that map to Beverly Call roles. Anything else is refused. */
const ROLE_MAP: Record<string, Role> = {
  'custom-call-centre-agent': 'agent',
  'custom-call-centre-supervisor': 'supervisor',
  'super-admin': 'admin',
}

export class AuthError extends Error {
  constructor(public status: 401 | 403, message: string) { super(message) }
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
export async function signInStaff(env: Env, email: string, password: string, f: FetchLike = fetch): Promise<{ user: SessionUser; token: string }> {
  const r = await f(`${env.BEVERLY_AUTH_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: env.BEVERLY_AUTH_ANON_KEY },
    body: JSON.stringify({ email, password }),
  })
  if (!r.ok) throw new AuthError(401, 'Invalid credentials')
  const parsed = supabaseLogin.safeParse(await r.json())
  if (!parsed.success) throw new AuthError(401, 'Invalid credentials')
  const { access_token: token, user } = parsed.data

  const p = await f(`${env.BEVERLY_AUTH_URL}/rest/v1/users?auth_user_id=eq.${encodeURIComponent(user.id)}&select=role_key,portal_access&limit=1`, {
    headers: { apikey: env.BEVERLY_AUTH_ANON_KEY, authorization: `Bearer ${token}` },
  })
  if (!p.ok) throw new Error(`Beverly profile lookup failed (${p.status})`)
  const row = staffRow.parse(await p.json())[0]
  const role = ROLE_MAP[row?.role_key ?? '']
  if (!row?.portal_access?.includes('call') || !role) throw new AuthError(403, 'No call centre access')

  const fullName = user.user_metadata.full_name
  return { user: { id: user.id, name: typeof fullName === 'string' && fullName ? fullName : email, role }, token }
}
