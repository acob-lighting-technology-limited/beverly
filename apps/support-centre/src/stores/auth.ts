import { defineStore } from 'pinia';
import { api } from '../lib/api';

export interface StaffUser {
  id: string;
  email: string;
  full_name: string;
  role: 'super-admin' | 'admin' | 'supervisor' | 'agent' | 'auditor';
  station_id?: string | null;
  station_ids?: string[];
  avatar?: string;
  password_reset_required?: boolean;
}

export const SUPER_ADMIN_IDENTITY: StaffUser = {
  id: 'admin',
  email: 'admin@acoblighting.com',
  full_name: 'Beverly Admin',
  role: 'super-admin',
  station_id: null,
  station_ids: [],
  avatar: 'BA',
  password_reset_required: false,
};

export const STAFF_PERMISSIONS: Record<string, string[]> = {
  'super-admin': [
    'info', 'verify', 'receipt', 'ticket', 'call_queue',
    'approve', 'monitor', 'recordings', 'recordings.delete',
    'analytics', 'outage_manage', 'audit', 'vend', 'admin',
    'wallet.customers.view', 'wallet.vending.monitor', 'wallet.support.manage'
  ],
  admin: [
    'info', 'verify', 'receipt', 'ticket', 'call_queue',
    'approve', 'monitor', 'recordings', 'recordings.delete',
    'analytics', 'outage_manage', 'audit', 'vend', 'admin',
    'wallet.customers.view', 'wallet.vending.monitor', 'wallet.support.manage'
  ],
  supervisor: [
    'info', 'verify', 'receipt', 'ticket', 'call_queue',
    'approve', 'monitor', 'recordings',
    'analytics', 'outage_manage',
    'wallet.customers.view', 'wallet.support.manage'
  ],
  agent: [
    'info', 'verify', 'receipt', 'ticket', 'call_queue',
    'wallet.customers.view'
  ],
  auditor: [
    'info', 'recordings', 'analytics', 'audit',
    'wallet.customers.view'
  ],
};

const ACCESS_TOKEN_KEY = 'beverly.staff.access_token';
const USER_KEY = 'beverly.staff.user';
const PERMS_KEY = 'beverly.staff.permissions';

export const useAuthStore = defineStore('supportAuth', {
  state: () => ({
    user: SUPER_ADMIN_IDENTITY as StaffUser,
    accessToken: (typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null) || 'local-dev-token',
    permissions: STAFF_PERMISSIONS['super-admin'] as string[],
    hydrated: false,
    loading: false,
  }),

  getters: {
    isAuthenticated: (state) => !!state.user && !!state.accessToken,
    isSuperAdmin: (state) => state.user?.role === 'super-admin' || state.user?.email === 'admin@acoblighting.com',
    role: (state) => state.user?.role || 'agent',
    stationScope: (state): string[] => {
      if (state.user?.role === 'super-admin' || state.user?.email === 'admin@acoblighting.com') return [];
      return state.user?.station_ids?.length ? state.user.station_ids : (state.user?.station_id ? [state.user.station_id] : []);
    },
    displayName: (state) => state.user?.full_name || 'Beverly Staff',
    displayEmail: (state) => state.user?.email || 'admin@acoblighting.com',
  },

  actions: {
    hydrate() {
      if (typeof window === 'undefined') return;
      try {
        const storedToken = localStorage.getItem(ACCESS_TOKEN_KEY);
        const storedUser = localStorage.getItem(USER_KEY);
        const storedPerms = localStorage.getItem(PERMS_KEY);

        if (storedUser) {
          this.user = JSON.parse(storedUser);
          this.accessToken = storedToken || 'local-dev-token';
          this.permissions = storedPerms ? JSON.parse(storedPerms) : (STAFF_PERMISSIONS[this.user.role] || STAFF_PERMISSIONS.agent);
        } else {
          // Default to canonical super-admin identity
          this.setSession('local-dev-token', SUPER_ADMIN_IDENTITY);
        }
      } catch (e) {
        this.setSession('local-dev-token', SUPER_ADMIN_IDENTITY);
      } finally {
        this.hydrated = true;
      }
    },

    setSession(token: string, user: StaffUser, perms?: string[]) {
      this.accessToken = token;
      this.user = user;
      this.permissions = perms || STAFF_PERMISSIONS[user.role] || STAFF_PERMISSIONS.agent;

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(ACCESS_TOKEN_KEY, token);
          localStorage.setItem(USER_KEY, JSON.stringify(this.user));
          localStorage.setItem(PERMS_KEY, JSON.stringify(this.permissions));
        } catch { /* storage quota or privacy mode */ }
      }
    },

    switchRole(newRole: 'super-admin' | 'admin' | 'supervisor' | 'agent' | 'auditor') {
      const updatedUser: StaffUser = {
        ...this.user,
        role: newRole,
      };
      this.setSession(this.accessToken, updatedUser, STAFF_PERMISSIONS[newRole]);
    },

    async revalidateSession() {
      if (!this.accessToken) return;
      this.loading = true;
      try {
        const res = await api.get<{ user: any; permissions?: string[] }>('/api/v1/admin/me');
        if (res && res.user) {
          const freshUser: StaffUser = {
            id: res.user.id || 'admin',
            email: res.user.email || 'admin@acoblighting.com',
            full_name: res.user.full_name || res.user.userName || 'Beverly Admin',
            role: res.user.role === 'super-admin' ? 'super-admin' : (res.user.role as any) || 'admin',
            station_id: res.user.station_id || null,
            station_ids: res.user.station_ids || [],
            avatar: res.user.full_name ? res.user.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'BA',
          };
          this.setSession(this.accessToken, freshUser, res.permissions || STAFF_PERMISSIONS[freshUser.role]);
        }
      } catch (err) {
        // Retain current session with fallback credentials
      } finally {
        this.loading = false;
      }
    },

    logout() {
      this.accessToken = '';
      this.user = SUPER_ADMIN_IDENTITY;
      this.permissions = [];
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem(ACCESS_TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          localStorage.removeItem(PERMS_KEY);
        } catch {}
      }
    },

    hasPermission(p: string): boolean {
      if (this.user?.role === 'super-admin' || this.user?.email === 'admin@acoblighting.com') return true;
      return this.permissions.includes(p);
    },
  },
});
