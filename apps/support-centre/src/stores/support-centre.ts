import { defineStore } from 'pinia';
import type {
  CallParty,
  CallSession,
  CaseItem,
  Customer360,
  IncidentItem,
  QualityRecord,
  QueueItem,
  StaffPresence,
} from '../types';

export const useSupportCentreStore = defineStore('supportCentre', {
  state: () => ({
    agent: {
      name: 'Amaka Mensah',
      role: 'Support Agent',
      location: 'Lagos Control Desk',
      avatar: 'AM',
      shift: 'Morning shift · 08:00–16:00 WAT',
    },
    presence: 'on_call' as StaffPresence,
    activeCall: {
      id: 'CALL-20261109-8812',
      direction: 'inbound' as const,
      status: 'connected' as const,
      caller: {
        id: 'CUS-10482',
        name: 'Ada Okafor',
        phone: '0803 210 4457',
        accountId: 'CUS-10482',
        meterNumber: 'BVL-00291',
        station: 'Ikeja Central',
        verified: true,
        avatar: 'AO',
      },
      startedAt: new Date(Date.now() - 258000).toISOString(), // 4m 18s ago
      durationSeconds: 258,
      isMuted: false,
      isOnHold: false,
      recordingConsentCapturedAt: '10:24 WAT',
      caseId: 'BVL-784561',
    } as CallSession | null,
    incomingCall: null as CallParty | null,
    queue: [
      {
        id: 'Q-01',
        callerName: 'Chidinma Eze',
        phone: '0803 441 9276',
        issue: 'Token not received',
        priority: 'urgent',
        waitSeconds: 242,
        queueType: 'voice',
        slaRisk: 'risk',
      },
      {
        id: 'Q-02',
        callerName: 'Bello Yusuf',
        phone: '0706 318 4401',
        issue: 'Meter not vending',
        priority: 'high',
        waitSeconds: 227,
        queueType: 'voice',
        slaRisk: 'warning',
      },
      {
        id: 'Q-03',
        callerName: 'Grace Nwosu',
        phone: '0812 904 1188',
        issue: 'Balance not updated',
        priority: 'normal',
        waitSeconds: 201,
        queueType: 'voice',
        slaRisk: 'safe',
      },
      {
        id: 'Q-04',
        callerName: 'Ibrahim Musa',
        phone: '0809 776 5502',
        issue: 'New meter request',
        priority: 'normal',
        waitSeconds: 156,
        queueType: 'voice',
        slaRisk: 'safe',
      },
      {
        id: 'Q-05',
        callerName: 'Tunde Adebayo',
        phone: '0704 229 7719',
        issue: 'High bill query',
        priority: 'normal',
        waitSeconds: 131,
        queueType: 'voice',
        slaRisk: 'safe',
      },
      {
        id: 'Q-CB-01',
        callerName: 'Emeka Obi',
        phone: '0802 334 1120',
        issue: 'Scheduled callback: Payment investigation',
        priority: 'high',
        waitSeconds: 450,
        queueType: 'callback',
        slaRisk: 'warning',
      },
      {
        id: 'Q-CB-02',
        callerName: 'Fatima Garba',
        phone: '0805 119 8832',
        issue: 'Scheduled callback: Meter inspection confirmation',
        priority: 'normal',
        waitSeconds: 310,
        queueType: 'callback',
        slaRisk: 'safe',
      },
      {
        id: 'Q-CB-03',
        callerName: 'Oluwaseun Bakare',
        phone: '0901 882 4471',
        issue: 'Scheduled callback: STS key revision check',
        priority: 'normal',
        waitSeconds: 180,
        queueType: 'callback',
        slaRisk: 'safe',
      },
    ] as QueueItem[],
    cases: [
      {
        id: 'CASE-01',
        reference: 'BVL-784561',
        title: 'Token not received',
        category: 'token_vending',
        priority: 'high',
        status: 'open',
        owner: 'Amaka Mensah',
        customerId: 'CUS-10482',
        customerName: 'Ada Okafor',
        customerPhone: '0803 210 4457',
        meterNumber: 'BVL-00291',
        lastPaymentSummary: '₦10,000 · Verified Paystack ref #PST-882194',
        purchaseStatus: 'Needs recovery check',
        slaRemainingMinutes: 26,
        notes: 'Customer confirms payment completed at 09:41. Check vending receipt and remote delivery before escalating to Finance.',
        createdAt: '2026-11-09T09:45:00Z',
      },
      {
        id: 'CASE-02',
        reference: 'BVL-784552',
        title: 'Tamper switch tripped after grid spike',
        category: 'meter_fault',
        priority: 'urgent',
        status: 'escalated_field',
        owner: 'Babajide Cole',
        customerId: 'CUS-09144',
        customerName: 'Victor Adeleke',
        customerPhone: '0802 911 3450',
        meterNumber: 'BVL-00184',
        lastPaymentSummary: '₦5,000 · Verified',
        purchaseStatus: 'Delivered',
        slaRemainingMinutes: 12,
        notes: 'Meter screen reads TAMP. Clear tamper token sent via SMS failed to clear physical contact latch. Field tech dispatched.',
        createdAt: '2026-11-09T08:15:00Z',
        escalatedTo: 'Field Operations',
      },
      {
        id: 'CASE-03',
        reference: 'BVL-784540',
        title: 'Duplicate wallet deduction on Monnify transfer',
        category: 'balance_discrepancy',
        priority: 'high',
        status: 'escalated_finance',
        owner: 'Kelechi Nwankwo',
        customerId: 'CUS-11290',
        customerName: 'Halima Bello',
        customerPhone: '0803 777 9912',
        meterNumber: 'BVL-00341',
        lastPaymentSummary: '₦15,000 · Bank webhook conflict',
        purchaseStatus: 'Under review',
        slaRemainingMinutes: 44,
        notes: 'Customer transferred ₦15,000 once; session timed out and customer retried. Bank confirmed double debit. Sent to Finance for reconciliation refund.',
        createdAt: '2026-11-09T07:50:00Z',
        escalatedTo: 'Finance',
      },
      {
        id: 'CASE-04',
        reference: 'BVL-784518',
        title: 'Tariff tier explanation for Band A feeder',
        category: 'tariff_query',
        priority: 'normal',
        status: 'resolved',
        owner: 'Amaka Mensah',
        customerId: 'CUS-08912',
        customerName: 'Chima Ugwu',
        customerPhone: '0807 554 2201',
        meterNumber: 'BVL-00078',
        lastPaymentSummary: '₦20,000 · Verified',
        purchaseStatus: 'Completed',
        slaRemainingMinutes: 0,
        notes: 'Clarified NERC Band A approved tariff rate of ₦209.50/kWh. Customer satisfied and copy of tariff schedule emailed.',
        createdAt: '2026-11-08T14:20:00Z',
        resolvedAt: '2026-11-08T14:42:00Z',
        resolutionCode: 'ADVISED_CUSTOMER',
      },
    ] as CaseItem[],
    activeCustomer: {
      id: 'CUS-10482',
      name: 'Ada Okafor',
      phone: '0803 210 4457',
      email: 'ada.okafor@example.com',
      customerSince: '12 Jun 2025',
      status: 'Active',
      meter: {
        number: 'BVL-00291',
        type: 'Prepaid STS 3-Phase',
        tariffCategory: 'Commercial Band A',
        status: 'Online · Pulse normal',
        lastTelemetryAt: '3 mins ago',
      },
      walletBalance: 3250.00,
      lastPayment: {
        amount: 10000.00,
        time: '09:41 WAT · today',
        reference: 'PST-882194-BF',
        status: 'Verified · Paystack Direct',
      },
      serviceArea: 'Ikeja Central, Lagos State',
      timeline: [
        {
          id: 'TL-1',
          title: 'Current voice call',
          subtitle: 'Token not received · Case #BVL-784561',
          time: '10:24 WAT · in progress',
          isLive: true,
          type: 'call',
        },
        {
          id: 'TL-2',
          title: 'Payment verified',
          subtitle: 'Paystack reference linked to token vending order',
          time: '09:41 WAT · today',
          type: 'payment',
        },
        {
          id: 'TL-3',
          title: 'Previous support case resolved',
          subtitle: 'Meter communication retry after GPRS antenna re-alignment',
          time: '16 Oct 2026 · 15:08',
          type: 'case',
        },
        {
          id: 'TL-4',
          title: 'Tariff Band migration notice',
          subtitle: 'Automated SMS sent regarding Band A schedule update',
          time: '01 Sep 2026 · 09:00',
          type: 'system',
        },
      ],
    } as Customer360 | null,
    incidents: [
      {
        id: 'INC-2026-08',
        title: 'Ikeja 33kV Feeder Tripped — Ikeja Central Substation',
        area: 'Ikeja Central & Allen Avenue Corridor',
        affectedStations: ['Ikeja Central', 'Allen Feed-1', 'Toyin St Mini-Grid'],
        affectedMeters: 412,
        status: 'monitoring',
        owner: 'Engr. Taiwo Balogun',
        startedAt: '2026-11-09T08:12:00Z',
        nextUpdate: '11:30 WAT',
        customerMessage: 'We are monitoring restored supply across Ikeja Central after TCN 33kV breaker reset. STS meters will reconnect automatically.',
      },
      {
        id: 'INC-2026-07',
        title: 'Paystack Card Processing Delayed Webhooks',
        area: 'Nationwide Online Funding',
        affectedStations: ['All minigrids'],
        affectedMeters: 89,
        status: 'resolved',
        owner: 'Finance Ops Lead',
        startedAt: '2026-11-08T16:00:00Z',
        nextUpdate: 'Resolved',
        customerMessage: 'Paystack has resolved card clearing delays. All queued wallet deposits have been reconciled and tokens dispatched.',
      },
    ] as IncidentItem[],
    qualityRecords: [
      {
        id: 'QA-01',
        callId: 'CALL-20261109-8801',
        agentName: 'Amaka Mensah',
        customerName: 'Chima Ugwu',
        duration: '03:42',
        recordedAt: '2026-11-08 14:38 WAT',
        score: 96,
        evaluated: true,
        notes: 'Excellent empathy, caller identity verified per protocol, resolved without unnecessary escalation.',
        checklist: {
          greeting: true,
          verification: true,
          diagnosis: true,
          accuracy: true,
          policyCompliance: true,
          documentation: true,
        },
      },
      {
        id: 'QA-02',
        callId: 'CALL-20261109-8794',
        agentName: 'Babajide Cole',
        customerName: 'Victor Adeleke',
        duration: '05:14',
        recordedAt: '2026-11-09 08:20 WAT',
        score: 88,
        evaluated: true,
        notes: 'Proper field escalation logged. Advised customer on safety precautions around damaged meter enclosure.',
        checklist: {
          greeting: true,
          verification: true,
          diagnosis: true,
          accuracy: true,
          policyCompliance: true,
          documentation: true,
        },
      },
    ] as QualityRecord[],
    searchQuery: '',
    callTimerInterval: null as ReturnType<typeof setInterval> | null,
    queueTimerInterval: null as ReturnType<typeof setInterval> | null,
  }),

  getters: {
    waitingCount: (state) => state.queue.filter((q) => q.queueType === 'voice').length,
    callbackCount: (state) => state.queue.filter((q) => q.queueType === 'callback').length,
    longestWaitSeconds: (state) => {
      if (!state.queue.length) return 0;
      return Math.max(...state.queue.map((q) => q.waitSeconds));
    },
    longestWaitFormatted(): string {
      const s = this.longestWaitSeconds;
      const mins = Math.floor(s / 60);
      const secs = s % 60;
      return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    },
    activeCase: (state) => {
      if (!state.activeCall?.caseId) return state.cases[0] || null;
      return state.cases.find((c) => c.reference === state.activeCall?.caseId) || state.cases[0] || null;
    },
    serviceLevelPercent(): number {
      return 83; // 83% within 5 min SLA
    },
  },

  actions: {
    startTimers() {
      if (!this.callTimerInterval) {
        this.callTimerInterval = setInterval(() => {
          if (this.activeCall && this.activeCall.status === 'connected') {
            this.activeCall.durationSeconds++;
          }
        }, 1000);
      }

      if (!this.queueTimerInterval) {
        this.queueTimerInterval = setInterval(() => {
          this.queue.forEach((q) => {
            q.waitSeconds++;
            if (q.waitSeconds > 240) {
              q.slaRisk = 'risk';
            } else if (q.waitSeconds > 180) {
              q.slaRisk = 'warning';
            }
          });
        }, 1000);
      }
    },

    stopTimers() {
      if (this.callTimerInterval) {
        clearInterval(this.callTimerInterval);
        this.callTimerInterval = null;
      }
      if (this.queueTimerInterval) {
        clearInterval(this.queueTimerInterval);
        this.queueTimerInterval = null;
      }
    },

    setPresence(status: StaffPresence) {
      this.presence = status;
    },

    toggleMute() {
      if (!this.activeCall) return;
      this.activeCall.isMuted = !this.activeCall.isMuted;
    },

    toggleHold() {
      if (!this.activeCall) return;
      this.activeCall.isOnHold = !this.activeCall.isOnHold;
      this.activeCall.status = this.activeCall.isOnHold ? 'on_hold' : 'connected';
    },

    endActiveCall() {
      if (!this.activeCall) return;
      this.activeCall.status = 'ended';
      this.presence = 'wrap_up';
      const finishedCall = { ...this.activeCall };
      
      // Auto create a quality record
      this.qualityRecords.unshift({
        id: `QA-${Date.now()}`,
        callId: finishedCall.id,
        agentName: this.agent.name,
        customerName: finishedCall.caller.name,
        duration: `${Math.floor(finishedCall.durationSeconds / 60)}:${String(finishedCall.durationSeconds % 60).padStart(2, '0')}`,
        recordedAt: `${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} WAT`,
        score: 92,
        evaluated: false,
        notes: 'Pending supervisor evaluation.',
        checklist: {
          greeting: true,
          verification: true,
          diagnosis: true,
          accuracy: true,
          policyCompliance: true,
          documentation: true,
        },
      });

      this.activeCall = null;
    },

    takeQueueCall(queueItemId: string) {
      const itemIndex = this.queue.findIndex((q) => q.id === queueItemId);
      if (itemIndex === -1) return;
      const item = this.queue[itemIndex];
      this.queue.splice(itemIndex, 1);

      this.presence = 'on_call';
      const ref = `BVL-${Math.floor(100000 + Math.random() * 900000)}`;

      this.activeCall = {
        id: `CALL-${Date.now()}`,
        direction: 'inbound',
        status: 'connected',
        caller: {
          id: `CUS-${Math.floor(10000 + Math.random() * 9000)}`,
          name: item.callerName,
          phone: item.phone,
          accountId: `ACC-${Math.floor(1000 + Math.random() * 9000)}`,
          meterNumber: `BVL-00${Math.floor(100 + Math.random() * 899)}`,
          station: 'Victoria Island West',
          verified: true,
          avatar: item.callerName.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase(),
        },
        startedAt: new Date().toISOString(),
        durationSeconds: 0,
        isMuted: false,
        isOnHold: false,
        recordingConsentCapturedAt: `${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} WAT`,
        caseId: ref,
      };

      const newCase: CaseItem = {
        id: `CASE-${Date.now()}`,
        reference: ref,
        title: item.issue,
        category: 'token_vending',
        priority: item.priority,
        status: 'open',
        owner: this.agent.name,
        customerId: this.activeCall.caller.id,
        customerName: item.callerName,
        customerPhone: item.phone,
        meterNumber: this.activeCall.caller.meterNumber,
        lastPaymentSummary: '₦8,500 · Verified recent deposit',
        purchaseStatus: 'Processing',
        slaRemainingMinutes: 30,
        notes: `Call connected from live queue regarding: ${item.issue}. Verified phone number ${item.phone}.`,
        createdAt: new Date().toISOString(),
      };

      this.cases.unshift(newCase);

      this.activeCustomer = {
        id: this.activeCall.caller.id,
        name: item.callerName,
        phone: item.phone,
        email: `${item.callerName.toLowerCase().replace(/\s+/g, '.')}@example.com`,
        customerSince: '14 Jan 2026',
        status: 'Active',
        meter: {
          number: this.activeCall.caller.meterNumber,
          type: 'Prepaid STS Single-Phase',
          tariffCategory: 'Residential R2',
          status: 'Online',
          lastTelemetryAt: 'Just now',
        },
        walletBalance: 1840.50,
        lastPayment: {
          amount: 8500.00,
          time: 'Earlier today',
          reference: `PAY-${Date.now().toString().slice(-6)}`,
          status: 'Verified',
        },
        serviceArea: 'Lagos Island, Lagos State',
        timeline: [
          {
            id: `TL-${Date.now()}`,
            title: 'Current incoming call',
            subtitle: `${item.issue} · Case #${ref}`,
            time: 'Just now',
            isLive: true,
            type: 'call',
          },
        ],
      };
    },

    updateCaseNotes(notes: string) {
      const c = this.activeCase;
      if (c) {
        c.notes = notes;
      }
    },

    resolveActiveCase(resolutionCode: string, notes?: string) {
      const c = this.activeCase;
      if (c) {
        c.status = 'resolved';
        c.resolutionCode = resolutionCode;
        c.resolvedAt = new Date().toISOString();
        if (notes) c.notes = `${c.notes}\n[RESOLVED: ${resolutionCode}] ${notes}`.trim();
      }
    },

    escalateActiveCase(target: 'Finance' | 'Field Operations', reason: string) {
      const c = this.activeCase;
      if (c) {
        c.status = target === 'Finance' ? 'escalated_finance' : 'escalated_field';
        c.escalatedTo = target;
        c.notes = `${c.notes}\n[ESCALATED TO ${target.toUpperCase()}]: ${reason}`.trim();
      }
    },

    searchCustomer(query: string) {
      const q = query.trim().toLowerCase();
      if (!q) return null;
      return (
        this.cases.find(
          (c) =>
            c.customerName.toLowerCase().includes(q) ||
            c.customerPhone.includes(q) ||
            c.meterNumber.toLowerCase().includes(q) ||
            c.reference.toLowerCase().includes(q)
        ) || null
      );
    },

    triggerSimulatedInbound() {
      this.incomingCall = {
        id: 'CUS-20891',
        name: 'Funke Akindele',
        phone: '0802 884 1920',
        accountId: 'CUS-20891',
        meterNumber: 'BVL-00512',
        station: 'Lekki Phase 1',
        verified: true,
        avatar: 'FA',
      };
    },

    acceptIncomingCall() {
      if (!this.incomingCall) return;
      const caller = this.incomingCall;
      this.incomingCall = null;
      this.presence = 'on_call';
      const ref = `BVL-${Math.floor(100000 + Math.random() * 900000)}`;

      this.activeCall = {
        id: `CALL-${Date.now()}`,
        direction: 'inbound',
        status: 'connected',
        caller,
        startedAt: new Date().toISOString(),
        durationSeconds: 0,
        isMuted: false,
        isOnHold: false,
        recordingConsentCapturedAt: `${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} WAT`,
        caseId: ref,
      };

      this.cases.unshift({
        id: `CASE-${Date.now()}`,
        reference: ref,
        title: 'Inbound Customer Call',
        category: 'token_vending',
        priority: 'normal',
        status: 'open',
        owner: this.agent.name,
        customerId: caller.id,
        customerName: caller.name,
        customerPhone: caller.phone,
        meterNumber: caller.meterNumber,
        lastPaymentSummary: '₦12,000 · Verified recent deposit',
        purchaseStatus: 'Completed',
        slaRemainingMinutes: 30,
        notes: `Call accepted from Africa's Talking Nigeria voice gateway. Phone ${caller.phone} verified.`,
        createdAt: new Date().toISOString(),
      });
    },

    declineIncomingCall() {
      this.incomingCall = null;
    },
  },
});
