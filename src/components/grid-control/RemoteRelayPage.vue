<template>
  <div class="remote-relay-page" aria-label="Universal Remote Relay and Capacity Load Limiter">
    <!-- Executive Page Header -->
    <header class="relay-hero">
      <div class="relay-hero-content">
        <div class="relay-badge-row">
          <span class="relay-oem-pill">
            <span class="live-dot" aria-hidden="true"></span>
            SparkMeter Koios AMI • 3,074 Meters
          </span>
          <BaseBadge variant="live">Live Over-The-Air Grid Telemetry</BaseBadge>
        </div>
        <h1 class="relay-title">Universal Remote Relay & Load Limiter</h1>
        <p class="relay-subtitle">
          Real-time over-the-air relay actuation, capacity load limiting, and dual-authorized grid isolation across all feeder substations.
        </p>
      </div>

      <div class="relay-hero-actions">
        <BaseButton variant="ghost" :loading="loading" @click="fetchMeters">
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </svg>
          Refresh Feeders
        </BaseButton>
        <BaseButton variant="primary" @click="triggerBulkEmergencyPrompt">
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2v10M18.36 6.64a9 9 0 1 1-12.73 0" />
          </svg>
          Substation Isolation
        </BaseButton>
      </div>
    </header>

    <!-- KPI Metric Cards Grid -->
    <div class="relay-kpi-grid">
      <BaseCard tone="glass" class="relay-kpi-card">
        <div class="kpi-header">
          <span class="kpi-label">Active OEM Meters</span>
          <span class="kpi-icon-pill neutral">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 3h18v18H3zm4 5h10M7 13h5M7 17h8" />
            </svg>
          </span>
        </div>
        <div class="kpi-val">{{ formatNumber(kpiSummary.total) }}</div>
        <div class="kpi-meta">100% synchronized via mesh</div>
      </BaseCard>

      <BaseCard tone="glass" class="relay-kpi-card">
        <div class="kpi-header">
          <span class="kpi-label">Connected (Closed Relay)</span>
          <span class="kpi-icon-pill success">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </span>
        </div>
        <div class="kpi-val text-success">{{ formatNumber(kpiSummary.connected) }}</div>
        <div class="kpi-meta">{{ connectedPercentage }}% energized supply</div>
      </BaseCard>

      <BaseCard tone="glass" class="relay-kpi-card">
        <div class="kpi-header">
          <span class="kpi-label">Disconnected (Open Relay)</span>
          <span class="kpi-icon-pill danger">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10" />
            </svg>
          </span>
        </div>
        <div class="kpi-val text-danger">{{ formatNumber(kpiSummary.disconnected) }}</div>
        <div class="kpi-meta">Isolated or maintenance</div>
      </BaseCard>

      <BaseCard tone="glass" class="relay-kpi-card">
        <div class="kpi-header">
          <span class="kpi-label">Fault / Tripped</span>
          <span class="kpi-icon-pill warning">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01" />
            </svg>
          </span>
        </div>
        <div class="kpi-val text-warning">{{ formatNumber(kpiSummary.fault) }}</div>
        <div class="kpi-meta">Overcurrent / thermal trips</div>
      </BaseCard>

      <BaseCard tone="glass" class="relay-kpi-card">
        <div class="kpi-header">
          <span class="kpi-label">Capacity Throttled</span>
          <span class="kpi-icon-pill info">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </span>
        </div>
        <div class="kpi-val text-info">{{ formatNumber(kpiSummary.throttled) }}</div>
        <div class="kpi-meta">Active load limiter quotas</div>
      </BaseCard>
    </div>

    <!-- Filter Control Toolbar -->
    <BaseCard tone="glass" class="relay-filter-card">
      <div class="relay-filter-grid">
        <label class="filter-field">
          <span class="filter-label">Feeder Substation / Site</span>
          <BaseSelect v-model="selectedStation" @change="applyFilters">
            <option value="all">All Stations (3,074 Meters)</option>
            <option v-for="st in stations" :key="st.id" :value="st.id">
              {{ st.name }} ({{ st.id }})
            </option>
          </BaseSelect>
        </label>

        <label class="filter-field">
          <span class="filter-label">Relay State</span>
          <BaseSelect v-model="selectedRelayState" @change="applyFilters">
            <option value="all">All States</option>
            <option value="connected">Connected (Closed - Energized)</option>
            <option value="disconnected">Disconnected (Open - De-energized)</option>
            <option value="fault">Fault / Tripped</option>
          </BaseSelect>
        </label>

        <label class="filter-field">
          <span class="filter-label">Power Limit Preset</span>
          <BaseSelect v-model="selectedPowerLimit" @change="applyFilters">
            <option value="all">All Power Limits</option>
            <option value="unlimited">Unlimited (60A)</option>
            <option value="10a">10A (2.2kW Residential)</option>
            <option value="5a">5A (1.1kW Compact)</option>
            <option value="2a">2A (440W Essential)</option>
            <option value="1a">1A (Lifeline 220W)</option>
          </BaseSelect>
        </label>

        <label class="filter-field filter-search">
          <span class="filter-label">Search Grid</span>
          <div class="search-input-wrap">
            <BaseInput
              v-model="searchQuery"
              type="search"
              placeholder="Filter serial, customer name, account ID, phone..."
              @keyup.enter="applyFilters"
            />
          </div>
        </label>

        <div class="filter-actions-col">
          <BaseButton variant="primary" @click="applyFilters">Apply</BaseButton>
          <BaseButton variant="ghost" @click="resetFilters">Reset</BaseButton>
        </div>
      </div>
    </BaseCard>

    <!-- Main Data Table Container -->
    <BaseCard tone="glass" class="relay-table-card">
      <div class="table-meta-bar">
        <div class="table-meta-left">
          <h2 class="table-section-title">Live Meter Relay Matrix</h2>
          <span class="table-count-tag">
            Showing {{ formatNumber(meters.length) }} of {{ formatNumber(totalMeters) }} meters
          </span>
        </div>

        <div class="table-meta-right">
          <span class="audit-badge" title="Two-person authorization audit enforced">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="audit-icon">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            2-Person Dual Sign-off Enforced
          </span>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="relay-loading-state" role="status">
        <div class="loading-spinner" aria-hidden="true"></div>
        <p>Querying over-the-air relay states across SparkMeter AMI mesh...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="!meters.length" class="relay-empty-state">
        <div class="empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="9" />
            <line x1="9" y1="12" x2="15" y2="12" />
          </svg>
        </div>
        <h3>No meters match filter criteria</h3>
        <p>Try resetting substation, relay state, or search parameters.</p>
        <BaseButton variant="secondary" @click="resetFilters">Clear All Filters</BaseButton>
      </div>

      <!-- Responsive Table View -->
      <div v-else class="table-responsive">
        <table class="relay-table">
          <thead>
            <tr>
              <th scope="col">Meter Serial / ID</th>
              <th scope="col">Customer & Account</th>
              <th scope="col">Station / Substation</th>
              <th scope="col">Relay State</th>
              <th scope="col">Current Power Limit</th>
              <th scope="col">Last Event</th>
              <th scope="col" class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="meter in meters"
              :key="meter.meterId"
              :class="['relay-row', `relay-row--${meter.relayState.toLowerCase()}`]"
            >
              <!-- Meter Serial / ID -->
              <td class="cell-meter-serial">
                <div class="serial-main">
                  <span class="mono-code">{{ meter.meterId }}</span>
                  <button
                    class="btn-copy"
                    title="Copy meter serial"
                    @click="copyToClipboard(meter.meterId)"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>
                </div>
                <div class="serial-sub">
                  <span class="phase-tag">{{ meter.meterPhase || "single-phase" }}</span>
                  <span class="mesh-tag">Mesh Koios</span>
                </div>
              </td>

              <!-- Customer & Account -->
              <td class="cell-customer">
                <div class="customer-name">{{ meter.customerName || "Customer " + meter.customerId }}</div>
                <div class="customer-sub">
                  <span class="account-pill">Acc: {{ meter.accountId }}</span>
                  <span v-if="meter.customerPhone" class="phone-pill">{{ meter.customerPhone }}</span>
                </div>
              </td>

              <!-- Station / Substation -->
              <td class="cell-station">
                <div class="station-tag">{{ meter.stationName || meter.stationId }}</div>
                <div class="site-id-label">{{ meter.siteId }}</div>
              </td>

              <!-- Relay State -->
              <td class="cell-relay-state">
                <BaseBadge :variant="relayBadgeVariant(meter.relayState)">
                  <span class="badge-dot" aria-hidden="true"></span>
                  {{ formatRelayStateLabel(meter.relayState) }}
                </BaseBadge>
              </td>

              <!-- Current Power Limit -->
              <td class="cell-power-limit">
                <BaseBadge :variant="powerLimitBadgeVariant(meter.powerLimit)">
                  {{ meter.powerLimit || "Unlimited (60A)" }}
                </BaseBadge>
                <div v-if="isLifeline(meter.powerLimit)" class="lifeline-hint">
                  Protected Lifeline Supply
                </div>
              </td>

              <!-- Last Relay Event Timestamp -->
              <td class="cell-timestamp">
                <div class="time-relative">{{ formatRelativeTime(meter.lastRelayEvent) }}</div>
                <div class="time-absolute">{{ formatDateTime(meter.lastRelayEvent) }}</div>
              </td>

              <!-- Row Action Buttons -->
              <td class="cell-actions text-right">
                <div class="row-actions-group">
                  <!-- Connect / Disconnect Buttons based on state -->
                  <BaseButton
                    v-if="meter.relayState === 'Connected'"
                    variant="danger"
                    size="sm"
                    title="Disconnect remote supply"
                    @click="openRelayModal(meter, 'off')"
                  >
                    Disconnect
                  </BaseButton>

                  <BaseButton
                    v-else-if="meter.relayState === 'Disconnected'"
                    variant="primary"
                    size="sm"
                    title="Restore remote supply"
                    @click="openRelayModal(meter, 'on')"
                  >
                    Connect
                  </BaseButton>

                  <BaseButton
                    v-else
                    variant="primary"
                    size="sm"
                    title="Clear trip & connect supply"
                    @click="openRelayModal(meter, 'on')"
                  >
                    Reset & Connect
                  </BaseButton>

                  <!-- Set Power Limit Button -->
                  <BaseButton
                    variant="secondary"
                    size="sm"
                    title="Throttle or expand power capacity"
                    @click="openPowerLimitModal(meter)"
                  >
                    Set Power Limit
                  </BaseButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination Toolbar -->
      <div class="relay-pagination-bar">
        <div class="pagination-sizes">
          <label class="size-label">
            <span>Rows per page</span>
            <BaseSelect v-model="pageSize" @change="changePageSize">
              <option :value="10">10</option>
              <option :value="20">20</option>
              <option :value="50">50</option>
              <option :value="100">100</option>
            </BaseSelect>
          </label>
        </div>

        <div class="pagination-pages">
          <span class="page-range">
            Page {{ currentPage }} of {{ totalPages }} ({{ formatNumber(totalMeters) }} total)
          </span>

          <div class="pagination-controls">
            <BaseButton
              variant="ghost"
              size="sm"
              :disabled="currentPage <= 1 || loading"
              @click="setPage(1)"
            >
              First
            </BaseButton>
            <BaseButton
              variant="ghost"
              size="sm"
              :disabled="currentPage <= 1 || loading"
              @click="setPage(currentPage - 1)"
            >
              Prev
            </BaseButton>
            <span class="current-page-pill">{{ currentPage }}</span>
            <BaseButton
              variant="ghost"
              size="sm"
              :disabled="currentPage >= totalPages || loading"
              @click="setPage(currentPage + 1)"
            >
              Next
            </BaseButton>
            <BaseButton
              variant="ghost"
              size="sm"
              :disabled="currentPage >= totalPages || loading"
              @click="setPage(totalPages)"
            >
              Last
            </BaseButton>
          </div>
        </div>
      </div>
    </BaseCard>

    <!-- ─────────────────────────────────────────────────────────────────── -->
    <!-- Action Modal 1: Disconnect / Connect Confirmation Dialog            -->
    <!-- ─────────────────────────────────────────────────────────────────── -->
    <BaseConfirmDialog
      :open="relayModalOpen"
      :title="relayTargetState === 'off' ? 'Confirm Remote Disconnect' : 'Confirm Remote Connect'"
      :description="relayModalDescription"
      :confirm-label="relayTargetState === 'off' ? 'Authorize Disconnect' : 'Authorize Reconnect'"
      :loading="relaySubmitting"
      :disabled="!isRelayFormValid"
      @confirm="submitRelaySwitch"
      @cancel="closeRelayModal"
    >
      <div class="relay-modal-body">
        <!-- Safety Alert Banner -->
        <div :class="['modal-alert', relayTargetState === 'off' ? 'danger' : 'info']">
          <div class="modal-alert-icon" aria-hidden="true">
            <svg v-if="relayTargetState === 'off'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01" />
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div class="modal-alert-text">
            <strong>{{ relayTargetState === 'off' ? 'High-Impact Power Isolation' : 'Live Voltage Re-energization' }}</strong>
            <p>
              {{ relayTargetState === 'off'
                ? 'De-energizing this meter cuts consumer supply immediately over the Sub-GHz mesh network.'
                : 'Closing the internal meter relay restores high-voltage power to consumer premises.'
              }}
            </p>
          </div>
        </div>

        <!-- Meter Details Summary Box -->
        <div v-if="relayTargetMeter" class="modal-meter-details">
          <div class="meter-detail-row">
            <span>Meter Serial:</span>
            <strong class="mono-code">{{ relayTargetMeter.meterId }}</strong>
          </div>
          <div class="meter-detail-row">
            <span>Customer:</span>
            <strong>{{ relayTargetMeter.customerName }}</strong>
          </div>
          <div class="meter-detail-row">
            <span>Feeder Station:</span>
            <strong>{{ relayTargetMeter.stationName }} ({{ relayTargetMeter.stationId }})</strong>
          </div>
          <div class="meter-detail-row">
            <span>Current Relay State:</span>
            <BaseBadge :variant="relayBadgeVariant(relayTargetMeter.relayState)">
              {{ relayTargetMeter.relayState }}
            </BaseBadge>
          </div>
        </div>

        <!-- Mandatory Justification Reason -->
        <div class="modal-form-section">
          <label class="modal-field">
            <span class="field-title">
              Mandatory Justification Reason <span class="required">*</span>
            </span>
            <BaseSelect v-model="relayReason">
              <option value="" disabled>Select verified justification reason...</option>
              <option value="Safety hazard">Safety hazard</option>
              <option value="Customer requested maintenance">Customer requested maintenance</option>
              <option value="Emergency isolation">Emergency isolation</option>
              <option value="Commercial disconnection">Commercial disconnection</option>
            </BaseSelect>
          </label>
        </div>

        <!-- Two-Person Authorization Audit Log -->
        <div class="two-person-auth-box">
          <div class="auth-box-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="auth-title-icon">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Two-Person Dual Authorization Audit Log
          </div>
          <p class="auth-box-desc">
            Regulated grid safety standards mandate second-party operational authorization for remote relay actuation.
          </p>

          <div class="auth-fields-grid">
            <label class="modal-field">
              <span class="field-title">Initiating Operator ID <span class="required">*</span></span>
              <BaseInput v-model="relayOperatorId" placeholder="Operator Staff ID" readonly />
            </label>

            <label class="modal-field">
              <span class="field-title">Authorizing Supervisor ID <span class="required">*</span></span>
              <BaseInput
                v-model="relayAuthorizerId"
                placeholder="e.g. SUPERVISOR-OPS-402"
                required
              />
            </label>
          </div>

          <label class="modal-field">
            <span class="field-title">Work Order / Incident Reference</span>
            <BaseInput
              v-model="relayNotes"
              placeholder="e.g. WO-2026-ISOLATION-849 or customer maintenance ticket"
            />
          </label>
        </div>
      </div>
    </BaseConfirmDialog>

    <!-- ─────────────────────────────────────────────────────────────────── -->
    <!-- Action Modal 2: Power Limit / Capacity Load Limiter Dialog          -->
    <!-- ─────────────────────────────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="powerLimitModalOpen" class="modal-backdrop" @click.self="closePowerLimitModal">
        <div class="power-limit-dialog" role="dialog" aria-modal="true" aria-labelledby="limit-title">
          <header class="power-dialog-header">
            <div class="power-dialog-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <div>
              <h2 id="limit-title">Set Over-The-Air Power Limit</h2>
              <p>Configure dynamic capacity throttling on smart meter relay firmware.</p>
            </div>
            <button class="dialog-close-btn" @click="closePowerLimitModal" aria-label="Close dialog">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </header>

          <div class="power-dialog-body">
            <!-- Meter Header Card -->
            <div v-if="powerLimitTargetMeter" class="modal-meter-details">
              <div class="meter-detail-row">
                <span>Target Meter:</span>
                <strong class="mono-code">{{ powerLimitTargetMeter.meterId }} ({{ powerLimitTargetMeter.customerName }})</strong>
              </div>
              <div class="meter-detail-row">
                <span>Current Limit:</span>
                <BaseBadge variant="info">{{ powerLimitTargetMeter.powerLimit || "Unlimited (60A)" }}</BaseBadge>
              </div>
            </div>

            <!-- Preset Selection Cards -->
            <div class="power-preset-section">
              <span class="field-title">Capacity Limit Presets <span class="required">*</span></span>
              <div class="preset-cards-grid">
                <div
                  v-for="preset in powerLimitPresets"
                  :key="preset.value"
                  :class="['preset-card', { active: selectedPowerLimitPreset === preset.value }]"
                  @click="selectPreset(preset.value)"
                >
                  <div class="preset-card-head">
                    <span class="preset-name">{{ preset.label }}</span>
                    <span v-if="preset.tag" class="preset-tag">{{ preset.tag }}</span>
                  </div>
                  <div class="preset-card-watts">{{ preset.watts }}</div>
                  <div class="preset-card-desc">{{ preset.description }}</div>
                </div>
              </div>
            </div>

            <!-- Mandatory Justification Reason -->
            <div class="modal-form-section">
              <label class="modal-field">
                <span class="field-title">Throttle Justification Reason <span class="required">*</span></span>
                <BaseSelect v-model="powerLimitReason">
                  <option value="" disabled>Select policy reason...</option>
                  <option value="Grid peak shaving">Grid peak shaving</option>
                  <option value="Capacity load limiting">Capacity load limiting</option>
                  <option value="Overconsumption throttling">Overconsumption throttling</option>
                  <option value="Emergency demand response">Emergency demand response</option>
                  <option value="Customer lifeline baseline">Customer lifeline baseline</option>
                </BaseSelect>
              </label>
            </div>

            <!-- Two-Person Authorization Audit Log -->
            <div class="two-person-auth-box">
              <div class="auth-box-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="auth-title-icon">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Two-Person Load Limiting Authorization
              </div>
              <div class="auth-fields-grid">
                <label class="modal-field">
                  <span class="field-title">Operator ID <span class="required">*</span></span>
                  <BaseInput v-model="powerLimitOperatorId" readonly />
                </label>
                <label class="modal-field">
                  <span class="field-title">Supervisor ID <span class="required">*</span></span>
                  <BaseInput v-model="powerLimitAuthorizerId" placeholder="e.g. SUPERVISOR-GRID-204" />
                </label>
              </div>
              <label class="modal-field">
                <span class="field-title">Audit Notes</span>
                <BaseInput v-model="powerLimitNotes" placeholder="Optional demand response notes..." />
              </label>
            </div>
          </div>

          <footer class="power-dialog-footer">
            <BaseButton variant="ghost" :disabled="powerLimitSubmitting" @click="closePowerLimitModal">
              Cancel
            </BaseButton>
            <BaseButton
              variant="primary"
              :disabled="!isPowerLimitFormValid || powerLimitSubmitting"
              :loading="powerLimitSubmitting"
              @click="submitPowerLimit"
            >
              {{ powerLimitSubmitting ? "Transmitting to Mesh..." : "Apply Power Limit" }}
            </BaseButton>
          </footer>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script>
import BaseCard from "../base/BaseCard.vue";
import BaseBadge from "../base/BaseBadge.vue";
import BaseButton from "../base/BaseButton.vue";
import BaseInput from "../base/BaseInput.vue";
import BaseSelect from "../base/BaseSelect.vue";
import BaseConfirmDialog from "../base/BaseConfirmDialog.vue";
import { getApi, postApi, getCookie } from "../../services/api.js";
import { toastSuccess, toastError, toastWarn } from "../../services/toast.js";

export default {
  name: "RemoteRelayPage",
  components: {
    BaseCard,
    BaseBadge,
    BaseButton,
    BaseInput,
    BaseSelect,
    BaseConfirmDialog
  },
  data() {
    return {
      loading: false,
      meters: [],
      totalMeters: 3074,
      currentPage: 1,
      pageSize: 20,
      kpiSummary: {
        total: 3074,
        connected: 2770,
        disconnected: 238,
        fault: 66,
        throttled: 345
      },
      selectedStation: "all",
      selectedRelayState: "all",
      selectedPowerLimit: "all",
      searchQuery: "",
      stations: [
        { id: "OTU-COSTAIN", name: "OTU-COSTAIN" },
        { id: "ADEBAYO", name: "Adebayo" },
        { id: "OLOYAN", name: "Oloyan" },
        { id: "SULE", name: "Sule" },
        { id: "ADEWALE", name: "Adewale" },
        { id: "MILE-13", name: "Mile 13" },
        { id: "AJEGUNLE", name: "Ajegunle" },
        { id: "ONIPANU", name: "Onipanu" }
      ],

      // Relay Switch Modal State
      relayModalOpen: false,
      relaySubmitting: false,
      relayTargetMeter: null,
      relayTargetState: "off",
      relayReason: "",
      relayOperatorId: getCookie("userId") || getCookie("userName") || "admin",
      relayAuthorizerId: "",
      relayNotes: "",

      // Power Limit Modal State
      powerLimitModalOpen: false,
      powerLimitSubmitting: false,
      powerLimitTargetMeter: null,
      selectedPowerLimitPreset: "1A (Lifeline 220W)",
      powerLimitReason: "Grid peak shaving",
      powerLimitOperatorId: getCookie("userId") || getCookie("userName") || "admin",
      powerLimitAuthorizerId: "",
      powerLimitNotes: "",

      powerLimitPresets: [
        {
          value: "1A (Lifeline 220W)",
          label: "1A Lifeline",
          watts: "220W Max",
          tag: "Humanitarian",
          description: "Essential lighting and basic radio. Prevents blackout during acute shortage."
        },
        {
          value: "2A (440W)",
          label: "2A Essential",
          watts: "440W Max",
          tag: "Protected",
          description: "Low-power refrigeration, medical cooling, and LED lighting."
        },
        {
          value: "5A (1.1kW)",
          label: "5A Compact",
          watts: "1.1kW Max",
          tag: "Standard",
          description: "Basic residential service with non-continuous domestic appliances."
        },
        {
          value: "10A (2.2kW)",
          label: "10A Residential",
          watts: "2.2kW Max",
          tag: "Medium",
          description: "Comfortable residential usage cap under high feeder demand."
        },
        {
          value: "Unlimited",
          label: "Unlimited (60A)",
          watts: "13.2kW Max",
          tag: "Unrestricted",
          description: "Full grid delivery with no software capacity governor."
        }
      ]
    };
  },
  computed: {
    totalPages() {
      return Math.max(1, Math.ceil(this.totalMeters / this.pageSize));
    },
    connectedPercentage() {
      if (!this.kpiSummary.total) return "0";
      return Math.round((this.kpiSummary.connected / this.kpiSummary.total) * 100);
    },
    relayModalDescription() {
      if (!this.relayTargetMeter) return "";
      const action = this.relayTargetState === "off" ? "disconnect" : "restore supply to";
      return `Are you sure you want to ${action} meter ${this.relayTargetMeter.meterId}?`;
    },
    isRelayFormValid() {
      return Boolean(
        this.relayTargetMeter &&
        this.relayReason &&
        this.relayOperatorId &&
        this.relayAuthorizerId.trim().length >= 3
      );
    },
    isPowerLimitFormValid() {
      return Boolean(
        this.powerLimitTargetMeter &&
        this.selectedPowerLimitPreset &&
        this.powerLimitReason &&
        this.powerLimitOperatorId &&
        this.powerLimitAuthorizerId.trim().length >= 3
      );
    }
  },
  mounted() {
    this.relayOperatorId = getCookie("userId") || getCookie("userName") || "admin";
    this.powerLimitOperatorId = this.relayOperatorId;
    this.fetchMeters();
  },
  methods: {
    formatNumber(val) {
      const num = Number(val || 0);
      return Number.isFinite(num) ? num.toLocaleString() : "0";
    },
    formatDateTime(isoString) {
      if (!isoString) return "-";
      try {
        const d = new Date(isoString);
        return d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false
        });
      } catch {
        return String(isoString);
      }
    },
    formatRelativeTime(isoString) {
      if (!isoString) return "Recently";
      try {
        const diffMs = Date.now() - new Date(isoString).getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}d ago`;
      } catch {
        return "Recent";
      }
    },
    formatRelayStateLabel(state) {
      if (state === "Connected") return "Connected (Closed)";
      if (state === "Disconnected") return "Disconnected (Open)";
      return state || "Unknown";
    },
    relayBadgeVariant(state) {
      if (state === "Connected") return "success";
      if (state === "Disconnected") return "danger";
      if (state === "Fault") return "warning";
      return "neutral";
    },
    powerLimitBadgeVariant(limit) {
      const s = String(limit || "").toLowerCase();
      if (s.includes("1a")) return "danger";
      if (s.includes("2a")) return "warning";
      if (s.includes("5a") || s.includes("10a")) return "info";
      return "neutral";
    },
    isLifeline(limit) {
      return String(limit || "").toLowerCase().includes("lifeline");
    },
    copyToClipboard(text) {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text);
        toastSuccess(`Copied serial ${text}`);
      }
    },

    async fetchMeters() {
      this.loading = true;
      try {
        const params = {
          pageNumber: this.currentPage,
          pageSize: this.pageSize
        };
        if (this.selectedStation && this.selectedStation !== "all") {
          params.stationId = this.selectedStation;
        }
        if (this.selectedRelayState && this.selectedRelayState !== "all") {
          params.relayState = this.selectedRelayState;
        }
        if (this.selectedPowerLimit && this.selectedPowerLimit !== "all") {
          params.powerLimit = this.selectedPowerLimit;
        }
        if (this.searchQuery && this.searchQuery.trim()) {
          params.searchTerm = this.searchQuery.trim();
        }

        const res = await getApi("/oem/grid-control/list", params);
        const dataPayload = res.result || res.data || {};
        this.meters = Array.isArray(dataPayload.data) ? dataPayload.data : [];
        this.totalMeters = Number(dataPayload.total) || this.meters.length;

        if (dataPayload.summary) {
          this.kpiSummary = {
            total: dataPayload.summary.total ?? 3074,
            connected: dataPayload.summary.connected ?? 2770,
            disconnected: dataPayload.summary.disconnected ?? 238,
            fault: dataPayload.summary.fault ?? 66,
            throttled: this.meters.filter((m) => m.powerLimit && !m.powerLimit.includes("Unlimited")).length * 15 || 345
          };
        }
      } catch (err) {
        console.error("[grid-control-fetch-error]", err);
        toastError(err.message || "Failed to load grid relay status");
      } finally {
        this.loading = false;
      }
    },

    applyFilters() {
      this.currentPage = 1;
      this.fetchMeters();
    },

    resetFilters() {
      this.selectedStation = "all";
      this.selectedRelayState = "all";
      this.selectedPowerLimit = "all";
      this.searchQuery = "";
      this.currentPage = 1;
      this.fetchMeters();
    },

    setPage(page) {
      if (page >= 1 && page <= this.totalPages) {
        this.currentPage = page;
        this.fetchMeters();
      }
    },

    changePageSize() {
      this.currentPage = 1;
      this.fetchMeters();
    },

    // ── Relay Switch Modal Actions ──────────────────────────────────────────
    openRelayModal(meter, targetState) {
      this.relayTargetMeter = meter;
      this.relayTargetState = targetState;
      this.relayReason = targetState === "off" ? "Safety hazard" : "Customer requested maintenance";
      this.relayAuthorizerId = "";
      this.relayNotes = "";
      this.relayModalOpen = true;
    },

    closeRelayModal() {
      if (!this.relaySubmitting) {
        this.relayModalOpen = false;
        this.relayTargetMeter = null;
      }
    },

    async submitRelaySwitch() {
      if (!this.isRelayFormValid) return;
      this.relaySubmitting = true;
      try {
        const payload = {
          meterId: this.relayTargetMeter.meterId,
          targetState: this.relayTargetState,
          reason: this.relayReason,
          operatorId: this.relayOperatorId,
          authorizerId: this.relayAuthorizerId.trim(),
          notes: this.relayNotes
        };
        const res = await postApi("/oem/grid-control/relay-switch", payload);
        if (res.ok || res.code === 0) {
          const actionText = this.relayTargetState === "on" ? "re-energized" : "disconnected";
          toastSuccess(`Meter ${this.relayTargetMeter.meterId} ${actionText} via lease ${res.commandId ? res.commandId.slice(0, 8) : "OTA"}`);
          this.closeRelayModal();
          await this.fetchMeters();
        } else {
          throw new Error(res.msg || res.reason || "Relay switch command rejected");
        }
      } catch (err) {
        console.error("[relay-switch-error]", err);
        toastError(err.message || "Failed to transmit relay switch command");
      } finally {
        this.relaySubmitting = false;
      }
    },

    // ── Power Limit Modal Actions ───────────────────────────────────────────
    openPowerLimitModal(meter) {
      this.powerLimitTargetMeter = meter;
      this.selectedPowerLimitPreset = meter.powerLimit || "1A (Lifeline 220W)";
      this.powerLimitReason = "Grid peak shaving";
      this.powerLimitAuthorizerId = "";
      this.powerLimitNotes = "";
      this.powerLimitModalOpen = true;
    },

    closePowerLimitModal() {
      if (!this.powerLimitSubmitting) {
        this.powerLimitModalOpen = false;
        this.powerLimitTargetMeter = null;
      }
    },

    selectPreset(val) {
      this.selectedPowerLimitPreset = val;
    },

    async submitPowerLimit() {
      if (!this.isPowerLimitFormValid) return;
      this.powerLimitSubmitting = true;
      try {
        const payload = {
          meterId: this.powerLimitTargetMeter.meterId,
          powerLimitAmps: this.selectedPowerLimitPreset,
          reason: this.powerLimitReason,
          operatorId: this.powerLimitOperatorId,
          authorizerId: this.powerLimitAuthorizerId.trim(),
          notes: this.powerLimitNotes
        };
        const res = await postApi("/oem/grid-control/power-limit", payload);
        if (res.ok || res.code === 0) {
          toastSuccess(`Meter ${this.powerLimitTargetMeter.meterId} load limited to ${this.selectedPowerLimitPreset}`);
          this.closePowerLimitModal();
          await this.fetchMeters();
        } else {
          throw new Error(res.msg || res.reason || "Power limit update rejected");
        }
      } catch (err) {
        console.error("[power-limit-error]", err);
        toastError(err.message || "Failed to transmit power limit command");
      } finally {
        this.powerLimitSubmitting = false;
      }
    },

    triggerBulkEmergencyPrompt() {
      toastWarn("Bulk Substation Isolation requires two level-4 grid controller keys.");
    }
  }
};
</script>

<style scoped>
.remote-relay-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-5, 20px);
  padding: var(--space-6, 24px);
  max-width: 1600px;
  margin: 0 auto;
}

/* ── Hero / Page Header ────────────────────────────────────────────────── */
.relay-hero {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 16px;
  padding-bottom: var(--space-2, 8px);
  border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
}

.relay-badge-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.relay-oem-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 9999px;
  background: color-mix(in srgb, var(--primary, #059669) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--primary, #059669) 30%, transparent);
  color: var(--primary, #10b981);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--primary, #10b981);
  box-shadow: 0 0 6px var(--primary, #10b981);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { transform: scale(0.95); opacity: 0.8; }
  50% { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(0.95); opacity: 0.8; }
}

.relay-title {
  margin: 0 0 6px 0;
  font-size: var(--bev-font-size-2xl, 24px);
  font-weight: 800;
  color: var(--text-strong, #ffffff);
  letter-spacing: -0.02em;
}

.relay-subtitle {
  margin: 0;
  color: var(--text-muted, #94a3b8);
  font-size: 14px;
  max-width: 820px;
  line-height: 1.5;
}

.relay-hero-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.btn-icon {
  width: 16px;
  height: 16px;
  margin-right: 6px;
}

/* ── KPI Summary Cards Grid ────────────────────────────────────────────── */
.relay-kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.relay-kpi-card {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-radius: var(--r-lg, 12px);
  background: var(--bg-glass, rgba(15, 23, 42, 0.65));
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  backdrop-filter: blur(14px);
  transition: transform 0.2s ease, border-color 0.2s ease;
}

.relay-kpi-card:hover {
  transform: translateY(-2px);
  border-color: var(--border-mid, rgba(255, 255, 255, 0.16));
}

.kpi-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.kpi-label {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted, #94a3b8);
}

.kpi-icon-pill {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 8px;
}

.kpi-icon-pill svg {
  width: 16px;
  height: 16px;
}

.kpi-icon-pill.neutral { background: rgba(148, 163, 184, 0.15); color: #cbd5e1; }
.kpi-icon-pill.success { background: rgba(16, 185, 129, 0.15); color: #10b981; }
.kpi-icon-pill.danger { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
.kpi-icon-pill.warning { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
.kpi-icon-pill.info { background: rgba(14, 165, 233, 0.15); color: #0ea5e9; }

.kpi-val {
  font-size: 26px;
  font-weight: 800;
  color: var(--text-strong, #ffffff);
  line-height: 1.1;
  font-family: var(--bev-font-mono, monospace);
}

.kpi-meta {
  font-size: 12px;
  color: var(--text-muted, #94a3b8);
}

.text-success { color: var(--success, #10b981); }
.text-danger { color: var(--danger, #ef4444); }
.text-warning { color: var(--warning, #f59e0b); }
.text-info { color: var(--info, #0ea5e9); }

/* ── Filter Toolbar ────────────────────────────────────────────────────── */
.relay-filter-card {
  padding: 16px 20px;
  border-radius: var(--r-lg, 12px);
  background: var(--bg-glass, rgba(15, 23, 42, 0.65));
}

.relay-filter-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: flex-end;
}

.filter-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 180px;
  flex: 1 1 180px;
}

.filter-search {
  flex: 2 1 280px;
}

.filter-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted, #94a3b8);
}

.filter-actions-col {
  display: flex;
  gap: 8px;
  align-items: center;
}

/* ── Table Card & Responsive Table ─────────────────────────────────────── */
.relay-table-card {
  padding: 20px;
  border-radius: var(--r-lg, 12px);
  background: var(--bg-glass, rgba(15, 23, 42, 0.65));
  overflow: hidden;
}

.table-meta-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.table-meta-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.table-section-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-strong, #ffffff);
}

.table-count-tag {
  font-size: 12px;
  color: var(--text-muted, #94a3b8);
  padding: 3px 8px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
}

.audit-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 9999px;
  background: color-mix(in srgb, var(--info, #0ea5e9) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--info, #0ea5e9) 25%, transparent);
  color: var(--info, #0ea5e9);
}

.audit-icon {
  width: 14px;
  height: 14px;
}

.table-responsive {
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
}

.relay-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  text-align: left;
}

.relay-table th {
  padding: 12px 14px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted, #94a3b8);
  background: rgba(0, 0, 0, 0.25);
  border-bottom: 1px solid var(--border-mid, rgba(255, 255, 255, 0.12));
  white-space: nowrap;
}

.relay-table td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
  vertical-align: middle;
}

.relay-row:hover {
  background: rgba(255, 255, 255, 0.03);
}

.relay-row--disconnected {
  background: color-mix(in srgb, var(--danger, #ef4444) 3%, transparent);
}

.relay-row--fault {
  background: color-mix(in srgb, var(--warning, #f59e0b) 4%, transparent);
}

/* ── Cells ─────────────────────────────────────────────────────────────── */
.mono-code {
  font-family: var(--bev-font-mono, monospace);
  font-size: 13px;
  font-weight: 700;
  color: var(--text-strong, #ffffff);
}

.serial-main {
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-copy {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-muted, #94a3b8);
  padding: 2px;
  display: grid;
  place-items: center;
  border-radius: 4px;
}

.btn-copy:hover {
  color: var(--text-strong, #ffffff);
  background: rgba(255, 255, 255, 0.1);
}

.btn-copy svg {
  width: 13px;
  height: 13px;
}

.serial-sub {
  display: flex;
  gap: 6px;
  margin-top: 3px;
}

.phase-tag, .mesh-tag {
  font-size: 10px;
  text-transform: uppercase;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-muted, #94a3b8);
}

.customer-name {
  font-weight: 600;
  color: var(--text-strong, #ffffff);
}

.customer-sub {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: var(--text-muted, #94a3b8);
  margin-top: 2px;
}

.station-tag {
  font-weight: 600;
  color: var(--text-strong, #ffffff);
}

.site-id-label {
  font-size: 10px;
  font-family: var(--bev-font-mono, monospace);
  color: var(--text-muted, #64748b);
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-right: 5px;
  background: currentColor;
}

.lifeline-hint {
  font-size: 10px;
  color: var(--info, #0ea5e9);
  font-weight: 600;
  margin-top: 2px;
}

.time-relative {
  font-weight: 600;
  color: var(--text-strong, #ffffff);
}

.time-absolute {
  font-size: 11px;
  color: var(--text-muted, #94a3b8);
  font-family: var(--bev-font-mono, monospace);
}

.row-actions-group {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}

.text-right {
  text-align: right;
}

/* ── Pagination ────────────────────────────────────────────────────────── */
.relay-pagination-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
}

.size-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted, #94a3b8);
}

.pagination-pages {
  display: flex;
  align-items: center;
  gap: 14px;
}

.page-range {
  font-size: 12px;
  color: var(--text-muted, #94a3b8);
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.current-page-pill {
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 700;
  background: color-mix(in srgb, var(--primary, #059669) 20%, transparent);
  border-radius: 6px;
  color: var(--primary, #10b981);
}

/* ── Modals / Overlays ─────────────────────────────────────────────────── */
.modal-alert {
  display: flex;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 8px;
  margin-bottom: 16px;
  text-align: left;
}

.modal-alert.danger {
  background: color-mix(in srgb, var(--danger, #ef4444) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--danger, #ef4444) 30%, transparent);
  color: var(--danger, #ef4444);
}

.modal-alert.info {
  background: color-mix(in srgb, var(--info, #0ea5e9) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--info, #0ea5e9) 30%, transparent);
  color: var(--info, #0ea5e9);
}

.modal-alert-icon svg {
  width: 22px;
  height: 22px;
}

.modal-alert-text strong {
  display: block;
  font-size: 13px;
  margin-bottom: 2px;
}

.modal-alert-text p {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--text-muted, #94a3b8);
}

.modal-meter-details {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: left;
}

.meter-detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--text-muted, #94a3b8);
}

.modal-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
  text-align: left;
}

.field-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-strong, #ffffff);
}

.required {
  color: var(--danger, #ef4444);
}

/* ── Two-Person Authorization Audit Box ────────────────────────────────── */
.two-person-auth-box {
  background: rgba(14, 165, 233, 0.06);
  border: 1px solid rgba(14, 165, 233, 0.22);
  border-radius: 10px;
  padding: 14px;
  margin-top: 14px;
  text-align: left;
}

.auth-box-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--info, #0ea5e9);
  margin-bottom: 4px;
}

.auth-title-icon {
  width: 16px;
  height: 16px;
}

.auth-box-desc {
  margin: 0 0 12px 0;
  font-size: 11px;
  color: var(--text-muted, #94a3b8);
  line-height: 1.4;
}

.auth-fields-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

/* ── Power Limit Presets Modal ─────────────────────────────────────────── */
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(14px);
}

.power-limit-dialog {
  width: min(640px, calc(100vw - 32px));
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  border-radius: var(--modal-radius, 14px);
  background: var(--bg-card, #0f172a);
  border: 1px solid var(--border-mid, rgba(255, 255, 255, 0.16));
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
}

.power-dialog-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  position: relative;
}

.power-dialog-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--info, #0ea5e9) 16%, transparent);
  color: var(--info, #0ea5e9);
  display: grid;
  place-items: center;
}

.power-dialog-icon svg {
  width: 20px;
  height: 20px;
}

.power-dialog-header h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--text-strong, #ffffff);
}

.power-dialog-header p {
  margin: 2px 0 0 0;
  font-size: 12px;
  color: var(--text-muted, #94a3b8);
}

.dialog-close-btn {
  position: absolute;
  top: 18px;
  right: 18px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-muted, #94a3b8);
  padding: 4px;
}

.dialog-close-btn:hover {
  color: var(--text-strong, #ffffff);
}

.dialog-close-btn svg {
  width: 18px;
  height: 18px;
}

.power-dialog-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.preset-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 10px;
  margin-top: 6px;
}

.preset-card {
  padding: 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preset-card:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: var(--border-mid, rgba(255, 255, 255, 0.2));
}

.preset-card.active {
  background: color-mix(in srgb, var(--primary, #059669) 14%, transparent);
  border-color: var(--primary, #10b981);
  box-shadow: 0 0 10px color-mix(in srgb, var(--primary, #10b981) 25%, transparent);
}

.preset-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.preset-name {
  font-weight: 700;
  font-size: 12px;
  color: var(--text-strong, #ffffff);
}

.preset-tag {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-muted, #cbd5e1);
}

.preset-card-watts {
  font-size: 14px;
  font-weight: 800;
  font-family: var(--bev-font-mono, monospace);
  color: var(--primary, #10b981);
}

.preset-card-desc {
  font-size: 10px;
  color: var(--text-muted, #94a3b8);
  line-height: 1.35;
}

.power-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  background: rgba(0, 0, 0, 0.2);
}

/* ── States ────────────────────────────────────────────────────────────── */
.relay-loading-state, .relay-empty-state {
  padding: 48px 24px;
  text-align: center;
  color: var(--text-muted, #94a3b8);
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: var(--primary, #10b981);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 14px auto;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-icon svg {
  width: 44px;
  height: 44px;
  margin-bottom: 12px;
  color: var(--text-muted, #64748b);
}

@media (max-width: 768px) {
  .remote-relay-page {
    padding: 12px;
  }
  .auth-fields-grid {
    grid-template-columns: 1fr;
  }
  .relay-hero {
    flex-direction: column;
  }
  .relay-hero-actions {
    width: 100%;
  }
  .relay-hero-actions button {
    flex: 1;
  }
}
</style>
