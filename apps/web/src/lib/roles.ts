import type { Role, ScreenId } from '@/types'

/** Screens each role may open. UX only: the API must enforce the same rules server-side. */
export const ROLE_SCREENS: Record<Role, ScreenId[]> = {
  agent: ['call', 'cust', 'cb', 'cases'],
  supervisor: ['call', 'cust', 'wall', 'cases', 'cb', 'rec', 'rep'],
  admin: ['cust', 'wall', 'cases', 'rec', 'rep', 'admin'],
}
export const DEFAULT_SCREEN: Record<Role, ScreenId> = { agent: 'call', supervisor: 'wall', admin: 'admin' }

/** Navigation groups: the first reachable screen of each group is the nav target. */
export const GROUPS: { label: string; icon: string; screens: ScreenId[] }[] = [
  { label: 'Calls', icon: 'phone', screens: ['call', 'cb'] },
  { label: 'Customers', icon: 'user', screens: ['cust'] },
  { label: 'Monitor', icon: 'grid', screens: ['wall', 'cases'] },
  { label: 'Review', icon: 'chart', screens: ['rec', 'rep'] },
  { label: 'Admin', icon: 'sliders', screens: ['admin'] },
]
export const SCREEN_TITLES: Record<ScreenId, string> = {
  call: 'Call', cb: 'Callbacks', cust: 'Customers', wall: 'Live wall',
  cases: 'Escalations', rec: 'Recordings', rep: 'Reports', admin: 'Admin',
}
export const canOpen = (role: Role, s: ScreenId) => ROLE_SCREENS[role].includes(s)
