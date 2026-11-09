<script setup lang="ts">
import { useSupportCentreStore } from '../stores/support-centre';

const store = useSupportCentreStore();
</script>

<template>
  <transition name="pop">
    <div v-if="store.incomingCall" class="incoming-banner" role="alert" aria-live="assertive">
      <div class="incoming-ring">
        <span class="ring-pulse"></span>
        <svg viewBox="0 0 24 24" class="phone-icon">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
        </svg>
      </div>

      <div class="incoming-info">
        <div class="incoming-badge">INCOMING CALL · AFRICA'S TALKING NIGERIA</div>
        <div class="incoming-name">{{ store.incomingCall.name }}</div>
        <div class="incoming-meta">
          <span>{{ store.incomingCall.phone }}</span>
          <span>·</span>
          <span>Meter {{ store.incomingCall.meterNumber }}</span>
          <span>·</span>
          <span>{{ store.incomingCall.station }}</span>
        </div>
      </div>

      <div class="incoming-actions">
        <button class="btn btn-decline" @click="store.declineIncomingCall">Decline</button>
        <button class="btn btn-accept" @click="store.acceptIncomingCall">
          <svg viewBox="0 0 24 24" class="btn-icon">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Accept Call
        </button>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.incoming-banner {
  position: fixed;
  top: 18px;
  right: 24px;
  z-index: 9999;
  background: var(--card);
  border: 2px solid var(--brand);
  border-radius: var(--r);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.22);
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 20px;
  min-width: 440px;
  backdrop-filter: blur(10px);
}

.incoming-ring {
  position: relative;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--brand-soft);
  color: var(--brand-deep);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.ring-pulse {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 2px solid var(--brand);
  animation: pulse 1.4s infinite;
}

@keyframes pulse {
  0% { transform: scale(0.95); opacity: 1; }
  100% { transform: scale(1.4); opacity: 0; }
}

.phone-icon {
  width: 20px;
  height: 20px;
  fill: currentColor;
}

.incoming-info {
  flex: 1;
  min-width: 0;
}

.incoming-badge {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--brand-deep);
  margin-bottom: 2px;
}

.incoming-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--ink);
}

.incoming-meta {
  font-size: 11px;
  color: var(--muted);
  display: flex;
  gap: 6px;
  margin-top: 2px;
}

.incoming-actions {
  display: flex;
  gap: 8px;
}

.btn {
  height: 36px;
  padding: 0 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s ease;
  border: 1px solid transparent;
}

.btn-decline {
  background: var(--canvas);
  color: var(--ink);
  border-color: var(--line-strong);
}

.btn-decline:hover {
  background: var(--red-soft);
  color: var(--red);
  border-color: var(--red);
}

.btn-accept {
  background: var(--brand);
  color: oklch(18% 0.02 145);
}

.btn-accept:hover {
  filter: brightness(1.08);
}

.btn-icon {
  width: 14px;
  height: 14px;
  stroke: currentColor;
  stroke-width: 2.5;
  fill: none;
}

.pop-enter-active,
.pop-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: translateY(-20px) scale(0.96);
}
</style>
