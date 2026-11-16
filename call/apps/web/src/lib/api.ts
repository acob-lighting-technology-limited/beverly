export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

/** Typed JSON fetch against the Beverly Call API. Cookies carry the session; 401 sends the user to sign in. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  })
  if (r.status === 401) { location.assign('/login'); throw new ApiError(401, 'Signed out') }
  if (!r.ok) throw new ApiError(r.status, `Request failed (${r.status})`)
  return (r.status === 204 ? undefined : await r.json()) as T
}
