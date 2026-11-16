import { defineStore } from 'pinia'
import { ref } from 'vue'

export type PanelId = 'notifications' | 'menu' | 'search' | 'settings' | 'handover' | 'shortcuts' | 'replies' | 'profile' | 'desk' | null

/** Which overlay is open. Only one at a time, so the app never stacks panels on top of each other. */
export const useUi = defineStore('ui', () => {
  const panel = ref<PanelId>(null)
  const deskTab = ref<'contact' | 'vending' | 'notes' | 'escalate'>('contact')
  const open = (p: Exclude<PanelId, null>): void => { panel.value = p }
  const close = (): void => { panel.value = null }
  const toggle = (p: Exclude<PanelId, null>): void => { panel.value = panel.value === p ? null : p }
  const openDesk = (tab: 'contact' | 'vending' | 'notes' | 'escalate' = 'contact'): void => { deskTab.value = tab; panel.value = 'desk' }
  return { panel, deskTab, open, close, toggle, openDesk }
})
