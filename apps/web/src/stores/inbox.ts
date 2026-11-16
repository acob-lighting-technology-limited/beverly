import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { AppNotification } from '@beverly-call/shared'
import { api } from '@/lib/api'
import { useToast } from '@/stores/toast'
import { useSettings } from '@/stores/settings'

const POLL_MS = 30_000

interface CoachPrompt { id: string; from: string; text: string; at: string }

/**
 * Real notifications only: everything here comes from /api/notifications, created by server events (assignments,
 * transfers, coaching, overdue cases, callbacks). Nothing is seeded or simulated in the browser.
 */
export const useInbox = defineStore('inbox', () => {
  const all = ref<AppNotification[]>([])
  const loaded = ref(false)
  let timer = 0
  let seen = new Set<string>()
  const settings = useSettings()

  /** Categories the user muted in Settings are hidden here (and do not count). */
  const items = computed(() => all.value.filter((n) => !settings.p.mute[n.category]))
  const unread = computed(() => items.value.filter((n) => n.unread).length)

  async function refresh(): Promise<void> {
    try {
      const next = await api<AppNotification[]>('/notifications')
      const toast = useToast()
      // Surface a toast for brand-new unread items after the first load.
      if (loaded.value) for (const n of next) if (n.unread && !seen.has(n.key) && !settings.p.mute[n.category]) toast.show(n.title)
      seen = new Set(next.map((n) => n.key))
      all.value = next
      loaded.value = true
    } catch { /* offline: keep the last list */ }
  }
  async function pollCoaching(): Promise<void> {
    try {
      const prompts = await api<CoachPrompt[]>('/coaching/inbox')
      if (prompts[0]) useToast().show(`Coach: ${prompts[0].text}`, 6000)
    } catch { /* agents only; other roles get 403 */ }
  }
  async function markRead(keys?: string[]): Promise<void> {
    all.value = all.value.map((n) => (!keys || keys.includes(n.key) ? { ...n, unread: false } : n))
    try { await api('/notifications/read', { method: 'POST', body: JSON.stringify(keys ? { keys } : {}) }) } catch { void refresh() }
  }
  function start(role: string | undefined): void {
    stop()
    void refresh()
    timer = window.setInterval(() => {
      if (document.hidden) return
      void refresh()
      if (role === 'agent') void pollCoaching()
    }, POLL_MS)
  }
  function stop(): void { clearInterval(timer); timer = 0; all.value = []; loaded.value = false; seen = new Set() }
  return { items, unread, loaded, refresh, markRead, start, stop }
})
