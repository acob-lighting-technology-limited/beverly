import { defineStore } from 'pinia';

export interface BatterySwapUser {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  station_id?: string | null;
  station_ids?: string[];
  login_voice_enabled?: boolean;
}

interface AuthState {
  hydrated: boolean;
  accessToken: string | null;
  user: BatterySwapUser | null;
}

export const useBatterySwapAuthStore = defineStore('battery-swap-auth', {
  state: (): AuthState => ({
    hydrated: false,
    accessToken: null,
    user: null
  }),

  getters: {
    isAuthenticated: (s) => Boolean(s.accessToken && s.user),
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
        const token =
          localStorage.getItem('beverly.battery_swap.access_token') ||
          localStorage.getItem('beverly.staff.access_token');
        const userJson =
          localStorage.getItem('beverly.battery_swap.user') ||
          localStorage.getItem('beverly.staff.user');

        if (token && userJson) {
          this.accessToken = token;
          this.user = JSON.parse(userJson);
        }
      } catch (err) {
        console.warn('[BatterySwapAuth] Failed to hydrate auth state:', err);
      }
    },

    setSession(token: string, user: BatterySwapUser) {
      this.accessToken = token;
      this.user = user;
      try {
        localStorage.setItem('beverly.battery_swap.access_token', token);
        localStorage.setItem('beverly.battery_swap.user', JSON.stringify(user));
        // Cross-portal compatibility with Beverly Staff Admin
        localStorage.setItem('beverly.staff.access_token', token);
        localStorage.setItem('beverly.staff.user', JSON.stringify(user));
      } catch (err) {
        console.warn('[BatterySwapAuth] Failed to persist session:', err);
      }
    },

    logout() {
      this.accessToken = null;
      this.user = null;
      try {
        localStorage.removeItem('beverly.battery_swap.access_token');
        localStorage.removeItem('beverly.battery_swap.user');
        localStorage.removeItem('beverly.staff.access_token');
        localStorage.removeItem('beverly.staff.user');
      } catch (err) {
        console.warn('[BatterySwapAuth] Failed to clear session:', err);
      }
    }
  }
});
