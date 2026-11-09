<script setup lang="ts">
import { useSupportCentreStore } from '../stores/support-centre';

const store = useSupportCentreStore();

const kpis = [
  { label: 'Service Level (within 5m)', value: '83.4%', change: '+2.1% vs last week', status: 'good' },
  { label: 'Average Speed to Answer', value: '28 sec', change: 'Target: < 45s', status: 'good' },
  { label: 'First Contact Resolution', value: '76.8%', change: 'Target: > 75%', status: 'good' },
  { label: 'Call Abandonment Rate', value: '2.4%', change: 'Industry standard: < 5%', status: 'good' },
  { label: 'Average Handle Time (AHT)', value: '04m 12s', change: 'Calm, verified pacing', status: 'neutral' },
  { label: 'Open Case Backlog', value: '14 cases', change: '3 escalated to Finance', status: 'neutral' },
];

const categoryBreakdown = [
  { category: 'Token & Vending Missing', percent: 42, count: 184, color: 'var(--brand)' },
  { category: 'Meter Hardware & Tamper', percent: 24, count: 105, color: 'var(--amber)' },
  { category: 'Payment / Wallet Transfer', percent: 18, count: 79, color: 'var(--blue)' },
  { category: 'Tariff & Billing Inquiry', percent: 11, count: 48, color: 'var(--muted)' },
  { category: 'Account Profile / KYC', percent: 5, count: 22, color: 'var(--faint)' },
];

const hourlyVolume = [
  { hour: '08:00', calls: 34 },
  { hour: '09:00', calls: 78 },
  { hour: '10:00', calls: 92 },
  { hour: '11:00', calls: 86 },
  { hour: '12:00', calls: 64 },
  { hour: '13:00', calls: 52 },
  { hour: '14:00', calls: 71 },
  { hour: '15:00', calls: 59 },
];
</script>

<template>
  <div class="analytics-page">
    <div class="page-head">
      <div>
        <h1>Support Centre Analytics</h1>
        <p>Operational health, telephony service levels and customer contact root causes.</p>
      </div>
      <div class="report-badge">
        <span>Report Window: <b>Today (Shift 1)</b></span>
      </div>
    </div>

    <!-- KPIs Grid -->
    <div class="kpi-grid">
      <div v-for="kpi in kpis" :key="kpi.label" class="kpi-card">
        <span class="kpi-label">{{ kpi.label }}</span>
        <b class="kpi-value">{{ kpi.value }}</b>
        <small class="kpi-change" :class="kpi.status">{{ kpi.change }}</small>
      </div>
    </div>

    <div class="charts-row">
      <!-- Hourly Call Demand -->
      <div class="panel">
        <div class="panel-header">
          <h3>Hourly Inbound Call Volume (WAT)</h3>
          <small>Africa's Talking Gateway</small>
        </div>
        <div class="panel-body">
          <div class="bar-chart">
            <div v-for="h in hourlyVolume" :key="h.hour" class="bar-col">
              <div class="bar-fill-wrapper">
                <div class="bar-fill" :style="{ height: `${(h.calls / 100) * 160}px` }"></div>
              </div>
              <span class="bar-count">{{ h.calls }}</span>
              <span class="bar-label">{{ h.hour }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Root Cause Category Breakdown -->
      <div class="panel">
        <div class="panel-header">
          <h3>Customer Contact Drivers</h3>
          <small>By Category</small>
        </div>
        <div class="panel-body">
          <div class="category-bars">
            <div v-for="cat in categoryBreakdown" :key="cat.category" class="cat-row">
              <div class="cat-info">
                <strong>{{ cat.category }}</strong>
                <span>{{ cat.count }} calls ({{ cat.percent }}%)</span>
              </div>
              <div class="progress-track">
                <div class="progress-fill" :style="{ width: `${cat.percent}%`, backgroundColor: cat.color }"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Telephony Costs & Resource Note -->
    <div class="panel summary-panel">
      <div class="summary-body">
        <div>
          <h4>Telephony Provider Health: Africa's Talking Nigeria</h4>
          <p>Active Virtual Number: <b>+234 1 888 2000</b> (Voice enabled) · Inbound SIP latency: <b>18ms</b> · Carrier connection rate: <b>99.8%</b></p>
        </div>
        <div class="summary-stat">
          <span>Voice Spend Today</span>
          <b>₦4,820.00</b>
          <small>Wallet Balance: ₦20,180.00</small>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.analytics-page {
  padding: 24px 30px 40px;
}

.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 24px;
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

.report-badge {
  font: 11px var(--mono);
  color: var(--muted);
}

.report-badge b {
  color: var(--ink);
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 14px;
  margin-bottom: 24px;
}

@media (max-width: 1300px) {
  .kpi-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.kpi-card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--r);
  padding: 16px 18px;
  box-shadow: var(--shadow-sm);
}

.kpi-label {
  display: block;
  font-size: 11px;
  color: var(--muted);
  font-weight: 600;
}

.kpi-value {
  display: block;
  font: 700 22px var(--mono);
  color: var(--ink);
  margin-top: 4px;
  letter-spacing: -0.5px;
}

.kpi-change {
  display: block;
  font-size: 11px;
  margin-top: 4px;
}

.kpi-change.good {
  color: var(--brand-deep);
  font-weight: 600;
}

.kpi-change.neutral {
  color: var(--muted);
}

.charts-row {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 20px;
  margin-bottom: 24px;
}

@media (max-width: 960px) {
  .charts-row {
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
  padding: 16px 20px;
  border-bottom: 1px solid var(--line);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-header h3 {
  margin: 0;
  font-size: 14px;
  color: var(--ink);
}

.panel-header small {
  color: var(--muted);
  font: 11px var(--mono);
}

.panel-body {
  padding: 24px;
}

/* Bar Chart */
.bar-chart {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  height: 200px;
  padding-top: 20px;
}

.bar-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  flex: 1;
}

.bar-fill-wrapper {
  height: 160px;
  display: flex;
  align-items: flex-end;
}

.bar-fill {
  width: 28px;
  background: var(--brand-soft);
  border-radius: 4px 4px 0 0;
  transition: all 0.3s ease;
  box-shadow: inset 0 -2px 0 var(--brand);
}

.bar-fill:hover {
  background: var(--brand);
}

.bar-count {
  font: 700 11px var(--mono);
  color: var(--ink);
}

.bar-label {
  font: 10px var(--mono);
  color: var(--muted);
}

/* Category Progress */
.category-bars {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cat-info {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  margin-bottom: 6px;
}

.cat-info strong {
  color: var(--ink);
}

.cat-info span {
  color: var(--muted);
  font-family: var(--mono);
}

.progress-track {
  height: 8px;
  background: var(--card-subtle);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 4px;
}

/* Summary Panel */
.summary-panel {
  background: var(--card-subtle);
}

.summary-body {
  padding: 20px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.summary-body h4 {
  margin: 0;
  font-size: 14px;
  color: var(--ink);
}

.summary-body p {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--muted);
}

.summary-body b {
  color: var(--ink);
}

.summary-stat {
  text-align: right;
}

.summary-stat span {
  display: block;
  font-size: 11px;
  color: var(--muted);
}

.summary-stat b {
  display: block;
  font: 700 20px var(--mono);
  color: var(--brand-deep);
  margin-top: 2px;
}

.summary-stat small {
  display: block;
  font: 10px var(--mono);
  color: var(--muted);
}
</style>
