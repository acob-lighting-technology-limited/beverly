<template>
  <section class="bw-kpi-grid bsv-station-kpi-grid" aria-label="Station Network KPIs">
    <!-- Active Hubs -->
    <article class="bw-kpi">
      <div class="bw-kpi-row">
        <span class="bw-kpi-label">ACTIVE HUBS</span>
        <span class="bw-kpi-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
          </svg>
        </span>
      </div>
      <strong class="bw-kpi-value">{{ stationCount }}</strong>
      <span class="bw-kpi-note">Lagos · Abuja · Ibadan · Akure</span>
    </article>

    <!-- Ready for Swap -->
    <article class="bw-kpi featured">
      <div class="bw-kpi-row">
        <span class="bw-kpi-label">READY TO SWAP</span>
        <span class="bw-kpi-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <rect x="2" y="7" width="16" height="10" rx="2" ry="2"/>
            <line x1="22" y1="11" x2="22" y2="13"/>
            <line x1="6" y1="12" x2="12" y2="12"/>
          </svg>
        </span>
      </div>
      <strong class="bw-kpi-value text-success">{{ totalReady }}</strong>
      <span class="bw-kpi-note">≥ 80% Full · Instant Pickup</span>
    </article>

    <!-- Fast Charging Bays -->
    <article class="bw-kpi warn-tone">
      <div class="bw-kpi-row">
        <span class="bw-kpi-label">CHARGING NOW</span>
        <span class="bw-kpi-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
        </span>
      </div>
      <strong class="bw-kpi-value text-warning">{{ totalCharging }}</strong>
      <span class="bw-kpi-note">Active Rack Recharging</span>
    </article>

    <!-- Open Drop-off Bays -->
    <article class="bw-kpi info-tone">
      <div class="bw-kpi-row">
        <span class="bw-kpi-label">OPEN LOCKERS</span>
        <span class="bw-kpi-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <rect x="3" y="11" width="18" height="11" rx="2"/>
            <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
          </svg>
        </span>
      </div>
      <strong class="bw-kpi-value">{{ totalEmptyLockers }}</strong>
      <span class="bw-kpi-note">Drop-off Bays Ready</span>
    </article>
  </section>
</template>

<script>
export default {
  name: "StationKpiStrip",
  props: {
    stationCount: { type: Number, default: 0 },
    totalReady: { type: Number, default: 0 },
    totalCharging: { type: Number, default: 0 },
    totalEmptyLockers: { type: Number, default: 0 }
  }
};
</script>

<style scoped>
.bsv-station-kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin: 1rem 0;
}

.bw-kpi {
  background: var(--acob-surface, rgba(10, 22, 15, 0.96));
  border: 1px solid var(--acob-line, rgba(255, 255, 255, 0.12));
  border-radius: var(--acob-radius-lg, 12px);
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-height: 110px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.bw-kpi:hover {
  border-color: var(--acob-line-strong, rgba(125, 252, 154, 0.28));
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
}

.bw-kpi.featured {
  border-color: rgba(34, 197, 94, 0.35);
  background: radial-gradient(120% 80% at 0% 0%, rgba(34, 197, 94, 0.10), transparent 50%), var(--acob-surface, rgba(10, 22, 15, 0.96));
}

.bw-kpi-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.bw-kpi-label {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--acob-muted, rgba(242, 247, 243, 0.65));
}

.bw-kpi-icon {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  color: var(--acob-muted, rgba(242, 247, 243, 0.65));
}

.bw-kpi.featured .bw-kpi-icon {
  background: rgba(34, 197, 94, 0.16);
  color: var(--acob-brand-mint, #7dfc9a);
}

.bw-kpi.warn-tone .bw-kpi-icon {
  background: rgba(245, 158, 11, 0.16);
  color: #f59e0b;
}

.bw-kpi.info-tone .bw-kpi-icon {
  background: rgba(59, 130, 246, 0.16);
  color: #60a5fa;
}

.bw-kpi-value {
  font-size: 1.65rem;
  font-weight: 800;
  font-family: var(--acob-font-mono, monospace);
  line-height: 1.1;
  color: var(--acob-text, #f2f7f3);
}

.text-success { color: var(--color-success, #22c55e) !important; }
.text-warning { color: var(--color-warning, #f59e0b) !important; }

.bw-kpi-note {
  font-size: 0.72rem;
  color: var(--acob-subtle, rgba(242, 247, 243, 0.45));
}

@media (max-width: 900px) {
  .bsv-station-kpi-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
}

@media (max-width: 480px) {
  .bsv-station-kpi-grid {
    grid-template-columns: 1fr;
  }
}
</style>
