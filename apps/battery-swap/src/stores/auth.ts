import { defineStore } from 'pinia';

/** Portal keys from users.portal_access (see backend staff-portal-access.ts). */
export type StaffPortalKey = 'crm' | 'staff_wallet' | 'call' | 'pue';

/** Identifies Beverly PUE to the backend's per-portal access check. */
export const PUE_PORTAL_HEADERS = { 'X-Beverly-Portal': 'pue' } as const;

export interface BatterySwapUser {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  station_id?: string | null;
  station_ids?: string[];
  login_voice_enabled?: boolean;
  portal_access?: StaffPortalKey[];
}

interface AuthState {
  hydrated: boolean;
  accessToken: string | null;
  user: BatterySwapUser | null;
}

/*
 * PUE keeps its own session keys. It used to share beverly.staff.* with Wallet
 * Admin, which let a session from one portal open the other without that
 * portal's access check.
 */
const TOKEN_KEY = 'beverly.battery_swap.access_token';
const USER_KEY = 'beverly.battery_swap.user';

/** Super admins always reach every portal; everyone else needs 'pue'. */
function canUsePue(user: BatterySwapUser | null): boolean {
  if (!user) return false;
  return user.role === 'super-admin' || (user.portal_access ?? []).includes('pue');
}

export const useBatterySwapAuthStore = defineStore('battery-swap-auth', {
  state: (): AuthState => ({
    hydrated: false,
    accessToken: null,
    user: null
  }),

  getters: {
    isAuthenticated: (s) => Boolean(s.accessToken && s.user && canUsePue(s.user)),
    displayName: (s) => s.user?.full_name || (s.user?.email ? s.user.email.split('@')[0] : 'Operations Officer'),
    roleLabel: (s) => {
      const r = s.user?.role || 'operations-officer';
      return r.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    },
    userInitials: (s) => {
      const name = s.user?.full_name || s.user?.email || 'BS';
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
      return name.slice(0, 2).toUpperCase();
    }
  },

  actions: {
    hydrate() {
      if (this.hydrated) return;
      this.hydrated = true;

      try {
        const token = localStorage.getItem(TOKEN_KEY);
        const userJson = localStorage.getItem(USER_KEY);
        if (token && userJson) {
          const user = JSON.parse(userJson) as BatterySwapUser;
          // Sessions saved before portal access existed have no list: sign in again.
          if (canUsePue(user)) {
            this.accessToken = token;
            this.user = user;
          } else {
            this.logout();
          }
        }
      } catch (err) {
        console.warn('[BatterySwapAuth] Failed to hydrate auth state:', err);
      }
    },

    setSession(token: string, user: BatterySwapUser) {
      this.accessToken = token;
      this.user = user;
      try {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      } catch (err) {
        console.warn('[BatterySwapAuth] Failed to persist session:', err);
      }
    },

    logout() {
      this.accessToken = null;
      this.user = null;
      try {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      } catch (err) {
        console.warn('[BatterySwapAuth] Failed to clear session:', err);
      }
    }
  }
});
