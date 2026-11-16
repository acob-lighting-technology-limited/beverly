import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Role, SessionUser } from '@/types'
import { ROLE_SCREENS } from '@/lib/roles'

/**
 * The session comes from the API (httpOnly cookie, Beverly staff sign-on, portal_access = call).
 * The browser never decides who a user is; `viewAs` only changes which screens an admin previews.
 */
export const useSession = defineStore('session', () => {
  const user = ref<SessionUser | null>(null)
  const viewAs = ref<Role | null>(null)
  const loaded = ref(false)
  const role = computed<Role | null>(() => viewAs.value ?? user.value?.role ?? null)
  const screens = computed(() => (role.value ? ROLE_SCREENS[role.value] : []))

  async function load() {
    try {
      const r = await fetch('/api/session', { credentials: 'same-origin' })
      user.value = r.ok ? ((await r.json()) as SessionUser) : null
    } catch { user.value = null }
    loaded.value = true
  }
  async function login(email: string, password: string) {
    const r = await fetch('/api/auth/login', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }),
    })
    if (!r.ok) throw new Error(r.status === 403 ? 'Your account has no call centre access.' : 'Sign-in failed. Check your details.')
    await load()
  }
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => undefined)
    user.value = null; viewAs.value = null
  }
  const setViewAs = (r: Role | null) => { if (user.value?.role === 'admin') viewAs.value = r === 'admin' ? null : r }
  return { user, role, viewAs, screens, loaded, load, login, logout, setViewAs }
})
