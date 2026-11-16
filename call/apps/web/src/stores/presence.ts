import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PresenceStatus } from '@beverly-call/shared'
import { api } from '@/lib/api'
import { useSession } from '@/stores/session'

const HEARTBEAT_MS = 30_000

/**
 * The signed-in agent's availability. The heartbeat tells the router who can take a call; the server keeps a
 * busy agent busy until wrap-up, whatever this reports. Admins are not call takers and do not heartbeat.
 */
export const usePresence = defineStore('presence', () => {
  const status = ref<PresenceStatus>('available')
  const languages = ref<string[]>(['en'])
  let timer = 0

  async function beat(): Promise<void> {
    const s = useSession()
    if (!s.user || s.user.role === 'admin') return
    try { await api('/presence', { method: 'PUT', body: JSON.stringify({ status: status.value, languages: languages.value }) }) } catch { /* next beat retries */ }
  }
  function start(): void {
    stop()
    void beat()
    timer = window.setInterval(() => { if (!document.hidden) void beat() }, HEARTBEAT_MS)
  }
  function stop(): void { clearInterval(timer); timer = 0 }
  async function set(s: PresenceStatus): Promise<void> { status.value = s; await beat() }
  return { status, languages, start, stop, set }
})
