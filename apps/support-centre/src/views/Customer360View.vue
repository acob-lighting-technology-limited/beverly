<script setup lang="ts">
import { ref } from 'vue';
import { useSupportCentreStore } from '../stores/support-centre';

const store = useSupportCentreStore();

const searchInput = ref('0803 210 4457');
const customer = ref(store.activeCustomer);

function performSearch() {
  const query = searchInput.value.trim().toLowerCase();
  if (!query) return;

  if (customer.value && (customer.value.phone.includes(query) || customer.value.name.toLowerCase().includes(query) || customer.value.meter.number.toLowerCase().includes(query))) {
    // Current customer matches
    return;
  }

  // Look up in store
  const matched = store.cases.find((c) =>
    c.customerPhone.includes(query) ||
    c.customerName.toLowerCase().includes(query) ||
    c.meterNumber.toLowerCase().includes(query)
  );

  if (matched) {
    customer.value = {
      id: matched.customerId,
      name: matched.customerName,
      phone: matched.customerPhone,
      email: `${matched.customerName.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      customerSince: '18 Aug 2025',
      status: 'Active',
      meter: {
        number: matched.meterNumber,
        type: 'Prepaid STS Single-Phase',
        tariffCategory: 'Residential R2',
        status: 'Online · Pulse normal',
        lastTelemetryAt: '5 mins ago',
      },
      walletBalance: 2450.00,
      lastPayment: {
        amount: 5000.00,
        time: 'Yesterday 14:22 WAT',
        reference: 'PAY-REF-9921',
        status: 'Verified Paystack Direct',
      },
      serviceArea: 'Lagos Island, Lagos',
      timeline: [
        {
          id: 'TL-SRCH-1',
          title: 'Case Logged',
          subtitle: `${matched.title} (#${matched.reference})`,
          time: 'Today',
          type: 'case',
        },
      ],
    };
  } else {
    alert('No customer record found matching that search term.');
  }
}
</script>

<template>
  <div class="customer-360-page">
    <div class="page-head">
      <div>
        <h1>Customer 360 Explorer</h1>
        <p>Comprehensive customer profile, meters, wallet balance and cross-channel interaction timeline.</p>
      </div>
      <div class="search-box">
        <input
          v-model="searchInput"
          type="text"
          placeholder="Search by phone (e.g. 0803...), meter number, or customer name..."
          @keyup.enter="performSearch"
        />
        <button class="btn btn-search" @click="performSearch">Search Record</button>
      </div>
    </div>

    <div v-if="customer" class="customer-layout">
      <!-- Profile & Meter Card -->
      <div class="panel">
        <div class="panel-header">
          <div class="user-hero">
            <div class="hero-avatar">{{ customer.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2) }}</div>
            <div>
              <h2>{{ customer.name }}</h2>
              <p>{{ customer.phone }} · {{ customer.email }}</p>
              <span class="badge verified">Verified Customer Identity</span>
            </div>
          </div>
          <div class="account-stat">
            <span>Customer ID</span>
            <b>{{ customer.id }}</b>
            <small>Active since {{ customer.customerSince }}</small>
          </div>
        </div>

        <div class="panel-body">
          <div class="section-title">Meter & Grid Connection</div>
          <div class="data-grid">
            <div class="data-item">
              <label>Assigned Meter</label>
              <b>{{ customer.meter.number }}</b>
              <small>{{ customer.meter.type }}</small>
            </div>
            <div class="data-item">
              <label>Tariff Classification</label>
              <b>{{ customer.meter.tariffCategory }}</b>
              <small>NERC Band Schedule Compliant</small>
            </div>
            <div class="data-item">
              <label>Telemetry State</label>
              <b class="text-brand">{{ customer.meter.status }}</b>
              <small>Last synced {{ customer.meter.lastTelemetryAt }}</small>
            </div>
            <div class="data-item">
              <label>Service Area & Feeder</label>
              <b>{{ customer.serviceArea }}</b>
              <small>Feeder Line A-102</small>
            </div>
          </div>

          <div class="section-title" style="margin-top: 24px;">Wallet & Recent Purchases</div>
          <div class="data-grid">
            <div class="data-item">
              <label>Current Wallet Balance</label>
              <b class="balance-amount">₦{{ customer.walletBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 }) }}</b>
              <small>Available for STS vending</small>
            </div>
            <div class="data-item">
              <label>Last Payment Recorded</label>
              <b>₦{{ customer.lastPayment.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 }) }}</b>
              <small>{{ customer.lastPayment.status }}</small>
            </div>
            <div class="data-item">
              <label>Payment Timestamp</label>
              <b>{{ customer.lastPayment.time }}</b>
              <small>Ref: {{ customer.lastPayment.reference }}</small>
            </div>
            <div class="data-item">
              <label>Account Health</label>
              <b class="text-brand">Normal · No Risk Holds</b>
              <small>KYC Level 2 Verified</small>
            </div>
          </div>
        </div>
      </div>

      <!-- Interaction History Card -->
      <div class="panel">
        <div class="panel-header">
          <h3>Interaction & Case History</h3>
          <span class="mono-badge">{{ customer.timeline.length }} events recorded</span>
        </div>

        <div class="timeline-container">
          <div
            v-for="event in customer.timeline"
            :key="event.id"
            class="timeline-item"
            :class="{ active: event.isLive }"
          >
            <div class="timeline-bullet"></div>
            <div class="timeline-details">
              <strong>{{ event.title }}</strong>
              <p>{{ event.subtitle }}</p>
              <time>{{ event.time }}</time>
            </div>
          </div>
        </div>

        <div class="panel-footer">
          <div class="notice-text">
            <b>Staff Governance:</b> Contact details and account transactions are logged for quality assurance and compliance under the Nigeria Data Protection Act (NDPA).
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.customer-360-page {
  padding: 24px 30px 40px;
}

.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 24px;
  gap: 20px;
  flex-wrap: wrap;
}

.page-head h1 {
  font-size: 24px;
  margin: 0;
  color: var(--ink);
  letter-spacing: -0.6px;
}

.page-head p {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 13px;
}

.search-box {
  display: flex;
  gap: 10px;
}

.search-box input {
  height: 38px;
  width: 380px;
  padding: 0 14px;
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  font-size: 13px;
  background: var(--card);
  color: var(--ink);
}

.btn-search {
  height: 38px;
  padding: 0 16px;
  background: var(--brand);
  color: oklch(18% 0.02 145);
  border: 1px solid var(--brand);
  border-radius: 6px;
  font-weight: 700;
  cursor: pointer;
}

.customer-layout {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 20px;
  align-items: start;
}

@media (max-width: 1024px) {
  .customer-layout {
    grid-template-columns: 1fr;
  }
}

.panel {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--r);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.panel-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--line);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.user-hero {
  display: flex;
  align-items: center;
  gap: 16px;
}

.hero-avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--brand-soft);
  color: var(--brand-deep);
  display: grid;
  place-items: center;
  font-size: 18px;
  font-weight: 800;
}

.user-hero h2 {
  margin: 0;
  font-size: 18px;
  color: var(--ink);
}

.user-hero p {
  margin: 3px 0 6px;
  font-size: 12px;
  color: var(--muted);
}

.badge.verified {
  background: var(--brand-soft);
  color: var(--brand-deep);
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
}

.account-stat {
  text-align: right;
}

.account-stat span {
  display: block;
  font-size: 11px;
  color: var(--muted);
}

.account-stat b {
  display: block;
  font: 700 18px var(--mono);
  color: var(--ink);
  margin: 2px 0;
}

.account-stat small {
  font-size: 11px;
  color: var(--muted);
}

.panel-body {
  padding: 24px;
}

.section-title {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--brand-deep);
  margin-bottom: 14px;
}

.data-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.data-item {
  background: var(--card-subtle);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 12px 16px;
}

.data-item label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
  margin-bottom: 4px;
}

.data-item b {
  display: block;
  font-size: 14px;
  color: var(--ink);
}

.balance-amount {
  color: var(--brand-deep) !important;
  font: 700 16px var(--mono);
}

.data-item small {
  display: block;
  font-size: 11px;
  color: var(--muted);
  margin-top: 2px;
}

.mono-badge {
  font: 11px var(--mono);
  color: var(--muted);
}

.timeline-container {
  padding: 20px 24px;
}

.timeline-item {
  position: relative;
  padding: 12px 0 12px 24px;
  border-left: 2px solid var(--line);
}

.timeline-bullet {
  position: absolute;
  left: -7px;
  top: 16px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--card);
  border: 2px solid var(--brand);
}

.timeline-item.active .timeline-bullet {
  border-color: var(--blue);
  background: var(--blue);
  box-shadow: 0 0 0 3px var(--blue-soft);
}

.timeline-details strong {
  display: block;
  font-size: 13px;
  color: var(--ink);
}

.timeline-details p {
  margin: 3px 0 4px;
  font-size: 12px;
  color: var(--muted);
}

.timeline-details time {
  font: 10px var(--mono);
  color: var(--faint);
}

.panel-footer {
  padding: 14px 24px;
  border-top: 1px solid var(--line);
  background: var(--canvas);
}

.notice-text {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.4;
}

.notice-text b {
  color: var(--ink);
}
</style>
