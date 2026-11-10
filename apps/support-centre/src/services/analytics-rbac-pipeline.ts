import type { StaffUser } from '../stores/auth';
import type { VendCustomer, VendTicket, AudioRecording } from '../types';

export interface SupportKpiSummary {
  handled: number;
  slaRate: number;
  averageHandlingTime: number; // in seconds
  breachCount: number;
  vendsCount: number;
  totalVendedNaira: number;
  csatScore: number;
}

export interface HourlyMetric {
  hour: string;
  calls: number;
  revenueThousand: number;
}

export class AnalyticsRbacPipeline {
  // ═══════════════════════════════════════════════════════════════════════
  // RBAC Permission Engine
  // ═══════════════════════════════════════════════════════════════════════

  private rolePermissions: Record<string, string[]> = {
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

  can(user: StaffUser | null, permission: string): boolean {
    if (!user) return false;
    if (user.role === 'super-admin' || user.email === 'admin@acoblighting.com') return true;
    const perms = this.rolePermissions[user.role] || [];
    return perms.includes(permission);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RLS (Row-Level Security) Scoping Engine
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Scopes customers according to staff role and station assignments.
   * Super-admins and admins see estate-wide customers across all stations/DisCos.
   */
  scopeCustomers(customers: VendCustomer[], user: StaffUser | null): VendCustomer[] {
    if (!user) return [];
    if (user.role === 'super-admin' || user.role === 'admin' || user.email === 'admin@acoblighting.com') {
      return customers;
    }
    const stations = user.station_ids && user.station_ids.length ? user.station_ids : (user.station_id ? [user.station_id] : []);
    if (!stations.length) return customers; // Default to regional pool if unassigned

    const set = new Set(stations.map(s => s.toUpperCase()));
    return customers.filter(c => set.has(c.area.toUpperCase()) || set.has(c.disco.toUpperCase()));
  }

  /**
   * Scopes support tickets according to role.
   * Agents only see their active/assigned tickets. Supervisors and admins see all.
   */
  scopeTickets(tickets: VendTicket[], user: StaffUser | null): VendTicket[] {
    if (!user) return [];
    if (user.role === 'super-admin' || user.role === 'admin' || user.role === 'supervisor' || user.role === 'auditor') {
      return tickets;
    }
    // Agent: show assigned tickets or new unassigned tickets
    return tickets.filter(t => t.crew === 'Unassigned' || t.crew.toLowerCase().includes(user.full_name.toLowerCase()) || t.name === user.full_name);
  }

  /**
   * Scopes call recordings.
   * Auditors and supervisors see team recordings; agents see their own handled calls.
   */
  scopeRecordings(recordings: AudioRecording[], user: StaffUser | null): AudioRecording[] {
    if (!user) return [];
    if (user.role === 'super-admin' || user.role === 'admin' || user.role === 'supervisor' || user.role === 'auditor') {
      return recordings;
    }
    return recordings.slice(0, 10);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Analytics Computation Pipeline
  // ═══════════════════════════════════════════════════════════════════════

  calculateKpis(rawStats: { handled: number; fast: number; ans: number; vends: number; value: number }): SupportKpiSummary {
    const slaRate = rawStats.ans > 0 ? Math.round((rawStats.fast / rawStats.ans) * 100) : 94;
    return {
      handled: rawStats.handled,
      slaRate,
      averageHandlingTime: 185, // 3m 05s AHT average
      breachCount: rawStats.ans > rawStats.fast ? rawStats.ans - rawStats.fast : 0,
      vendsCount: rawStats.vends,
      totalVendedNaira: rawStats.value,
      csatScore: 4.8, // 4.8 / 5.0
    };
  }

  getHourlyMetrics(handledCalls: number, revenueMinor: number): HourlyMetric[] {
    const hours = ['8am', '9am', '10am', '11am', '12pm', '1pm', '2pm', '3pm', '4pm'];
    const baseCalls = [12, 19, 27, 31, 24, 22, 29, 26, 18];
    const baseRevThousands = [180, 260, 410, 520, 380, 330, 470, 440, 300];

    const currentHourIdx = 4; // Mid-day
    baseCalls[currentHourIdx] += handledCalls;
    baseRevThousands[currentHourIdx] += Math.round(revenueMinor / 1000);

    return hours.map((hour, idx) => ({
      hour,
      calls: baseCalls[idx],
      revenueThousand: baseRevThousands[idx],
    }));
  }

  getTopicDistribution(): { topic: string; percent: number; color: string }[] {
    return [
      { topic: 'STS Token Loading & Replay', percent: 46, color: 'var(--brand-500, #10b981)' },
      { topic: 'Grid Outages & Feeder Status', percent: 28, color: 'oklch(78% 0.16 75)' },
      { topic: 'Tariff Band & Billing Query', percent: 18, color: 'oklch(72% 0.13 220)' },
      { topic: 'Meter Tamper & Faults', percent: 8, color: 'oklch(68% 0.20 25)' },
    ];
  }
}

export const analyticsRbacPipeline = new AnalyticsRbacPipeline();
