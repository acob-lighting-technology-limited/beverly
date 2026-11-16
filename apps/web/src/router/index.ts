import { createRouter, createWebHistory } from 'vue-router'
import { useSession } from '@/stores/session'
import { DEFAULT_SCREEN, canOpen } from '@/lib/roles'
import { screenTitle } from '@/lib/i18n'
import { useSettings } from '@/stores/settings'
import type { ScreenId } from '@/types'

const screen = (id: ScreenId, component: () => Promise<unknown>) =>
  ({ path: `/${id}`, name: id, component, meta: { screen: id } })

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: () => import('../views/LoginView.vue'), meta: { public: true } },
    screen('call', () => import('../views/CallView.vue')),
    screen('cb', () => import('../views/CallbacksView.vue')),
    screen('cases', () => import('../views/CasesView.vue')),
    screen('cust', () => import('../views/CustomersView.vue')),
    screen('wall', () => import('../views/WallView.vue')),
    screen('rec', () => import('../views/RecordingsView.vue')),
    screen('rep', () => import('../views/ReportsView.vue')),
    screen('admin', () => import('../views/AdminView.vue')),
    { path: '/:rest(.*)*', redirect: '/call' },
  ],
})

router.beforeEach(async (to) => {
  const s = useSession()
  if (!s.loaded) await s.load()
  if (to.meta.public) return s.user ? { path: `/${DEFAULT_SCREEN[s.user.role]}` } : true
  if (!s.user || !s.role) return { name: 'login' }
  const id = to.meta.screen as ScreenId | undefined
  if (id && !canOpen(s.role, id)) return { path: `/${DEFAULT_SCREEN[s.role]}` }
  return true
})

/** Keep the browser tab title and screen-reader context in step with the open screen. */
router.afterEach((to) => {
  const id = to.meta.screen as ScreenId | undefined
  document.title = id ? `${screenTitle(useSettings().p.lang, id)} · Beverly Call` : 'Beverly Call'
})
