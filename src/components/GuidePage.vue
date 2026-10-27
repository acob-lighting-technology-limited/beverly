<script setup>
import { ref, computed } from 'vue';
import {
  guideStats,
  guideStory,
  guideModuleGroups,
  guideHighlights,
  firstWeekSteps,
  guideFaqGroups,
  securityPoints,
} from '../data/guide-content.js';
import BaseButton from './base/BaseButton.vue';

const props = defineProps({
  route: {
    type: Object,
    default: () => ({}),
  },
});

// Interactive FAQ state
const activeFaqTab = ref(guideFaqGroups[0]?.id || 'account');
const openQuestion = ref(guideFaqGroups[0]?.items[0]?.q || null);

const currentFaqGroup = computed(() => {
  return guideFaqGroups.find((g) => g.id === activeFaqTab.value) || guideFaqGroups[0];
});

function toggleQuestion(q) {
  openQuestion.value = openQuestion.value === q ? null : q;
}

function selectFaqTab(id) {
  activeFaqTab.value = id;
  const grp = guideFaqGroups.find((g) => g.id === id);
  openQuestion.value = grp?.items[0]?.q || null;
}
</script>

<template>
  <div class="guide-scope crm-guide-page">
    <!-- Hero Section -->
    <section class="crm-guide-card crm-guide-hero">
      <div class="crm-hero-ambient" aria-hidden="true"></div>
      <div class="crm-hero-grid" aria-hidden="true"></div>

      <p class="crm-eyebrow">
        <span class="crm-eyebrow-accent" aria-hidden="true"></span>
        Beverly guide
      </p>

      <h1 class="crm-guide-h1">One grid. Every energy workflow.</h1>

      <p class="crm-guide-lead">
        Beverly is the operational nervous system for your smart mini-grid infrastructure.
        From Calinmeter and SparkMeter token generation to real-time IoT power quality telemetry and double-entry energy wallets—everything connects here.
      </p>

      <div class="crm-hero-actions">
        <a href="#first-week" class="crm-btn-primary">
          Start here
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </a>
        <a href="#modules" class="crm-btn-outline">
          Browse modules
        </a>
      </div>
    </section>

    <!-- Stats Band -->
    <section class="crm-stats-grid">
      <div
        v-for="stat in guideStats"
        :key="stat.label"
        class="crm-guide-card crm-stat-card"
      >
        <p class="crm-stat-value">
          {{ stat.value }}<span v-if="stat.suffix" class="crm-stat-suffix">{{ stat.suffix }}</span>
        </p>
        <p class="crm-stat-label">{{ stat.label }}</p>
      </div>
    </section>

    <!-- Transformation Story -->
    <section class="crm-guide-section">
      <p class="crm-eyebrow">
        <span class="crm-eyebrow-accent" aria-hidden="true"></span>
        The shift
      </p>
      <h2 class="crm-guide-h2">Why mini-grids run on Beverly.</h2>
      <p class="crm-guide-lead">
        Energy distribution in remote and commercial markets used to mean manual scratch tokens, lost vending slips, and unmetered bypass. Beverly replaces guesswork with certainty.
      </p>

      <div class="crm-story-grid">
        <div
          v-for="item in guideStory"
          :key="item.kicker"
          class="crm-guide-card crm-story-card"
        >
          <span
            :class="['crm-story-pill', { 'is-now': item.kicker === 'Now' }]"
          >
            {{ item.kicker }}
          </span>
          <p class="crm-story-title">{{ item.title }}</p>
          <p class="crm-story-body">{{ item.body }}</p>
        </div>
      </div>
    </section>

    <!-- Module Directory -->
    <section id="modules" class="crm-guide-section crm-scroll-anchor">
      <p class="crm-eyebrow">
        <span class="crm-eyebrow-accent" aria-hidden="true"></span>
        Module directory
      </p>
      <h2 class="crm-guide-h2">Your modules.</h2>
      <p class="crm-guide-lead">
        Every tool is built around an operational task: issuing tokens, balancing feeder meters, reviewing audits, and reconciling daily cash flows.
      </p>

      <div class="crm-groups-stack">
        <div
          v-for="group in guideModuleGroups"
          :key="group.key"
          class="crm-module-group"
        >
          <div class="crm-group-header">
            <span class="crm-group-dot"></span>
            <p class="crm-group-title">{{ group.label }}</p>
            <span class="crm-group-count">{{ group.modules.length }} modules</span>
          </div>

          <div class="crm-modules-grid">
            <a
              v-for="mod in group.modules"
              :key="mod.name"
              :href="mod.href"
              class="crm-guide-card crm-module-card"
            >
              <div class="crm-module-card-top">
                <span class="crm-icon-badge">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                    <rect x="3" y="3" width="7" height="7" rx="1.5" />
                    <rect x="14" y="3" width="7" height="7" rx="1.5" />
                    <rect x="3" y="14" width="7" height="7" rx="1.5" />
                    <rect x="14" y="14" width="7" height="7" rx="1.5" />
                  </svg>
                </span>
                <span class="crm-arrow-icon" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </span>
              </div>
              <p class="crm-module-title">{{ mod.name }}</p>
              <p class="crm-module-summary">{{ mod.summary }}</p>
            </a>
          </div>
        </div>
      </div>
    </section>

    <!-- Architecture Highlights -->
    <section class="crm-guide-section">
      <p class="crm-eyebrow">
        <span class="crm-eyebrow-accent" aria-hidden="true"></span>
        Architecture
      </p>
      <h2 class="crm-guide-h2">Built for mission-critical reliability.</h2>
      <p class="crm-guide-lead">
        Mini-grids operate in challenging network conditions. Beverly separates offline STS vending from cloud telemetry aggregation so field tokens vend reliably even during internet dropouts.
      </p>

      <div class="crm-highlights-grid">
        <div
          v-for="item in guideHighlights"
          :key="item.tag"
          class="crm-guide-card crm-highlight-card"
        >
          <div class="crm-watermark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <span class="crm-badge font-mono">{{ item.tag }}</span>
          <p class="crm-highlight-title">{{ item.title }}</p>
          <p class="crm-highlight-body">{{ item.body }}</p>
          <a
            v-if="item.href"
            :href="item.href"
            class="crm-highlight-link"
          >
            Explore module
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </a>
        </div>
      </div>
    </section>

    <!-- First Week -->
    <section id="first-week" class="crm-guide-section crm-scroll-anchor">
      <p class="crm-eyebrow">
        <span class="crm-eyebrow-accent" aria-hidden="true"></span>
        Start here
      </p>
      <h2 class="crm-guide-h2">Your first week in Beverly.</h2>

      <div class="crm-steps-grid">
        <div
          v-for="(step, idx) in firstWeekSteps"
          :key="step.title"
          class="crm-guide-card crm-step-card"
        >
          <span class="crm-step-num">{{ String(idx + 1).padStart(2, '0') }}</span>
          <p class="crm-step-title">{{ step.title }}</p>
          <p class="crm-step-body">{{ step.body }}</p>
          <a
            v-if="step.href && step.cta"
            :href="step.href.startsWith('/') ? `/wallet-admin${step.href}` : step.href"
            class="crm-step-cta"
          >
            {{ step.cta }}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </a>
        </div>
      </div>
    </section>

    <!-- Interactive FAQ -->
    <section class="crm-guide-section">
      <p class="crm-eyebrow">
        <span class="crm-eyebrow-accent" aria-hidden="true"></span>
        Questions
      </p>
      <h2 class="crm-guide-h2">Things people ask.</h2>

      <div class="crm-faq-layout">
        <!-- Topic Tabs -->
        <div role="tablist" class="crm-faq-tabs" aria-label="Question topics">
          <BaseButton
            v-for="grp in guideFaqGroups"
            :key="grp.id"
            role="tab"
            variant="quiet"
            :aria-selected="grp.id === activeFaqTab"
            :class="['crm-faq-tab', { active: grp.id === activeFaqTab }]"
            @click="selectFaqTab(grp.id)"
          >
            <span class="crm-faq-tab-label">{{ grp.title }}</span>
            <span class="crm-faq-tab-count">{{ grp.items.length }}</span>
          </BaseButton>
        </div>

        <!-- Accordion Items -->
        <div role="tabpanel" class="crm-faq-panel">
          <div
            v-for="item in currentFaqGroup.items"
            :key="item.q"
            :class="['crm-faq-item', { 'is-open': openQuestion === item.q }]"
          >
            <BaseButton
              variant="quiet"
              class="crm-faq-trigger"
              :aria-expanded="openQuestion === item.q"
              @click="toggleQuestion(item.q)"
            >
              <span class="crm-faq-question">{{ item.q }}</span>
              <span class="crm-faq-toggle-icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </span>
            </BaseButton>
            <div v-show="openQuestion === item.q" class="crm-faq-answer">
              <p>{{ item.a }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Security Banner -->
    <section class="crm-guide-section">
      <div class="crm-guide-card crm-security-banner">
        <div class="crm-security-ambient" aria-hidden="true"></div>
        <p class="crm-eyebrow justify-center">
          <span class="crm-eyebrow-accent" aria-hidden="true"></span>
          Secured by design
        </p>
        <h2 class="crm-guide-h2 text-center">Need a hand? You're covered.</h2>
        <p class="crm-guide-lead text-center">
          Chat directly with AcoBot for quick answers, or raise a Help Desk ticket when field equipment requires investigation.
          Your data stays protected the whole way.
        </p>
        <ul class="crm-security-tags" aria-label="Security standards">
          <li v-for="point in securityPoints" :key="point" class="crm-badge">
            {{ point }}
          </li>
        </ul>
        <div class="crm-security-actions">
          <a href="/wallet-admin/support" class="crm-btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 13v-1a8 8 0 0 1 16 0v1" />
              <path d="M5 13h2a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2Z" />
              <path d="M19 13h-2a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h1" />
            </svg>
            Raise a support ticket
          </a>
          <a href="#/dashboard" class="crm-btn-outline">
            Back to Dashboard
          </a>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* ── Exact ACOB ERP Guide Color Tokens ── */
.guide-scope {
  --primary: oklch(0.45 0.2 142);
  --primary-foreground: oklch(1 0 0);
  --background: oklch(0.955 0.003 75);
  --foreground: oklch(0.25 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.25 0 0);
  --muted: oklch(0.93 0.003 75);
  --muted-foreground: oklch(0.25 0 0);
  --border: oklch(0.875 0.002 75);
  --ring: oklch(0.45 0.2 142);
}

:root[data-theme="dark"] .guide-scope,
:root[data-theme="executive"] .guide-scope,
:root[data-theme="contrast"] .guide-scope,
.dark .guide-scope {
  --primary: oklch(0.65 0.15 142);
  --primary-foreground: oklch(0.145 0 0);
  --background: oklch(0.13 0.002 72);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.175 0.003 72);
  --card-foreground: oklch(0.985 0 0);
  --muted: oklch(0.255 0.003 72);
  --muted-foreground: oklch(0.708 0 0);
  --border: oklch(0.255 0.003 72);
  --ring: oklch(0.65 0.15 142);
}

.crm-guide-page {
  padding: 1.5rem 1rem 4rem;
  max-width: 1240px;
  margin: 0 auto;
  color: var(--foreground);
}

@media (min-width: 640px) {
  .crm-guide-page {
    padding: 2rem 1.5rem 6rem;
  }
}

/* Card base */
.crm-guide-card {
  background: var(--card);
  color: var(--card-foreground);
  border: 1px solid var(--border);
  border-radius: 0.875rem;
  position: relative;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

/* Hero */
.crm-guide-hero {
  padding: 2rem 1.5rem;
  overflow: hidden;
  margin-bottom: 2rem;
}

@media (min-width: 640px) {
  .crm-guide-hero {
    padding: 3.5rem 3rem;
  }
}

.crm-hero-ambient {
  position: absolute;
  top: -10rem;
  right: -8rem;
  width: 30rem;
  height: 30rem;
  border-radius: 9999px;
  background: radial-gradient(circle, color-mix(in oklch, var(--primary) 28%, transparent), transparent 70%);
  pointer-events: none;
  z-index: 1;
}

.crm-hero-grid {
  position: absolute;
  inset: 0;
  opacity: 0.4;
  background-size: 32px 32px;
  background-image: 
    linear-gradient(to right, color-mix(in oklch, var(--border) 40%, transparent) 1px, transparent 1px),
    linear-gradient(to bottom, color-mix(in oklch, var(--border) 40%, transparent) 1px, transparent 1px);
  pointer-events: none;
  z-index: 1;
}

.crm-guide-hero > * {
  position: relative;
  z-index: 2;
}

/* Eyebrow */
.crm-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.125em;
  color: var(--primary);
  margin: 0 0 0.75rem;
  font-weight: 600;
}

.crm-eyebrow-accent {
  display: inline-block;
  height: 0.75rem;
  width: 0.25rem;
  transform: skewX(-35deg);
  border-radius: 0.125rem;
  background: var(--primary);
  flex-shrink: 0;
}

/* Headings */
.crm-guide-h1 {
  font-size: 2.25rem;
  line-height: 1.1;
  font-weight: 700;
  letter-spacing: -0.03em;
  margin: 0.5rem 0 1rem;
  color: var(--foreground);
}

@media (min-width: 640px) {
  .crm-guide-h1 {
    font-size: 3.5rem;
  }
}

.crm-guide-h2 {
  font-size: 1.75rem;
  line-height: 1.18;
  font-weight: 600;
  letter-spacing: -0.02em;
  margin: 0.25rem 0 0.75rem;
  color: var(--foreground);
}

@media (min-width: 640px) {
  .crm-guide-h2 {
    font-size: 2.5rem;
  }
}

.crm-guide-lead {
  font-size: 1rem;
  line-height: 1.6;
  color: var(--muted-foreground);
  margin: 0 0 1.5rem;
  max-width: 44rem;
}

@media (min-width: 640px) {
  .crm-guide-lead {
    font-size: 1.125rem;
  }
}

/* Buttons */
.crm-hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.crm-btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  font-size: 0.9375rem;
  font-weight: 600;
  border-radius: 0.5rem;
  background: var(--primary);
  color: var(--primary-foreground);
  text-decoration: none;
  border: none;
  cursor: pointer;
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.crm-btn-primary:hover {
  opacity: 0.92;
  transform: translateY(-1px);
}

.crm-btn-outline {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  font-size: 0.9375rem;
  font-weight: 600;
  border-radius: 0.5rem;
  background: transparent;
  color: var(--foreground);
  text-decoration: none;
  border: 1px solid var(--border);
  cursor: pointer;
  transition: background-color 0.18s ease;
}

.crm-btn-outline:hover {
  background: color-mix(in oklch, var(--primary) 8%, transparent);
  border-color: color-mix(in oklch, var(--primary) 40%, transparent);
}

/* Stats */
.crm-stats-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  margin-bottom: 3.5rem;
}

@media (min-width: 640px) {
  .crm-stats-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1rem;
  }
}

.crm-stat-card {
  padding: 1.5rem 1.25rem;
  text-align: center;
}

.crm-stat-value {
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, monospace);
  font-size: 2rem;
  font-weight: 700;
  margin: 0;
  line-height: 1;
  color: var(--foreground);
}

@media (min-width: 640px) {
  .crm-stat-value {
    font-size: 2.75rem;
  }
}

.crm-stat-suffix {
  color: var(--primary);
  font-size: 0.8em;
}

.crm-stat-label {
  font-size: 0.8125rem;
  color: var(--muted-foreground);
  margin: 0.5rem 0 0;
  font-weight: 500;
}

/* Sections */
.crm-guide-section {
  margin-bottom: 4rem;
}

.crm-scroll-anchor {
  scroll-margin-top: 2rem;
}

/* Story */
.crm-story-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr;
  margin-top: 1.5rem;
}

@media (min-width: 768px) {
  .crm-story-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.crm-story-card {
  padding: 1.5rem;
}

.crm-story-pill {
  display: inline-block;
  padding: 0.25rem 0.625rem;
  font-family: var(--font-mono, monospace);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  border-radius: 0.375rem;
  background: var(--muted);
  color: var(--muted-foreground);
  margin-bottom: 0.75rem;
}

.crm-story-pill.is-now {
  background: color-mix(in oklch, var(--primary) 15%, transparent);
  color: var(--primary);
  border: 1px solid color-mix(in oklch, var(--primary) 30%, transparent);
}

.crm-story-title {
  font-size: 1.0625rem;
  font-weight: 600;
  margin: 0 0 0.5rem;
  color: var(--foreground);
}

.crm-story-body {
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--muted-foreground);
  margin: 0;
}

/* Modules */
.crm-groups-stack {
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
  margin-top: 1.5rem;
}

.crm-group-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border);
  margin-bottom: 1rem;
}

.crm-group-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 9999px;
  background: var(--primary);
}

.crm-group-title {
  font-size: 1.1875rem;
  font-weight: 600;
  margin: 0;
  color: var(--foreground);
}

.crm-group-count {
  margin-left: auto;
  font-family: var(--font-mono, monospace);
  font-size: 0.75rem;
  color: var(--muted-foreground);
}

.crm-modules-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr;
}

@media (min-width: 640px) {
  .crm-modules-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .crm-modules-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.crm-module-card {
  display: flex;
  flex-direction: column;
  padding: 1.25rem;
  text-decoration: none;
  color: inherit;
}

.crm-module-card:hover {
  border-color: color-mix(in oklch, var(--primary) 40%, transparent);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.crm-module-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.crm-icon-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 9999px;
  background: color-mix(in oklch, var(--primary) 10%, transparent);
  border: 1px solid var(--border);
  color: var(--primary);
}

.crm-arrow-icon {
  color: var(--muted-foreground);
  transition: transform 0.2s ease, color 0.2s ease;
}

.crm-module-card:hover .crm-arrow-icon {
  color: var(--primary);
  transform: translateX(2px);
}

.crm-module-title {
  font-size: 0.9375rem;
  font-weight: 600;
  margin: 0 0 0.35rem;
  color: var(--foreground);
}

.crm-module-card:hover .crm-module-title {
  color: var(--primary);
}

.crm-module-summary {
  font-size: 0.8125rem;
  line-height: 1.55;
  color: var(--muted-foreground);
  margin: 0;
}

/* Highlights */
.crm-highlights-grid {
  display: grid;
  gap: 1.25rem;
  grid-template-columns: 1fr;
  margin-top: 1.5rem;
}

@media (min-width: 768px) {
  .crm-highlights-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.crm-highlight-card {
  padding: 1.75rem;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.crm-watermark {
  position: absolute;
  right: -2rem;
  bottom: -2rem;
  width: 10rem;
  height: 10rem;
  color: color-mix(in oklch, var(--primary) 7%, transparent);
  pointer-events: none;
}

.crm-highlight-title {
  font-size: 1.1875rem;
  font-weight: 700;
  margin: 0.75rem 0 0.5rem;
  color: var(--foreground);
  position: relative;
  z-index: 2;
}

.crm-highlight-body {
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--muted-foreground);
  margin: 0 0 1.25rem;
  position: relative;
  z-index: 2;
  flex-grow: 1;
}

.crm-highlight-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--primary);
  text-decoration: none;
  position: relative;
  z-index: 2;
}

.crm-highlight-link:hover {
  text-decoration: underline;
}

/* Steps */
.crm-steps-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr;
  margin-top: 1.5rem;
}

@media (min-width: 640px) {
  .crm-steps-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .crm-steps-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.crm-step-card {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
}

.crm-step-num {
  font-family: var(--font-mono, monospace);
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--primary);
  margin-bottom: 0.75rem;
}

.crm-step-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 0.5rem;
  color: var(--foreground);
}

.crm-step-body {
  font-size: 0.8125rem;
  line-height: 1.55;
  color: var(--muted-foreground);
  margin: 0;
  flex-grow: 1;
}

.crm-step-cta {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--primary);
  text-decoration: none;
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border);
}

.crm-step-cta:hover {
  text-decoration: underline;
}

/* FAQ */
.crm-faq-layout {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: 1fr;
  margin-top: 1.5rem;
}

@media (min-width: 1024px) {
  .crm-faq-layout {
    grid-template-columns: 280px 1fr;
  }
}

.crm-faq-tabs {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: var(--card);
  padding: 0.5rem;
  border-radius: 0.75rem;
  border: 1px solid var(--border);
  height: fit-content;
}

.crm-faq-tab {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--muted-foreground);
  text-align: left;
  cursor: pointer;
  border: none;
  background: transparent;
  transition: all 0.18s ease;
}

.crm-faq-tab:hover {
  background: color-mix(in oklch, var(--primary) 8%, transparent);
  color: var(--foreground);
}

.crm-faq-tab.active {
  background: var(--primary);
  color: var(--primary-foreground);
  font-weight: 600;
}

.crm-faq-tab-count {
  font-family: var(--font-mono, monospace);
  font-size: 0.75rem;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  background: var(--muted);
  color: var(--muted-foreground);
}

.crm-faq-tab.active .crm-faq-tab-count {
  background: color-mix(in oklch, var(--primary-foreground) 20%, transparent);
  color: var(--primary-foreground);
}

.crm-faq-panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.crm-faq-item {
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  background: var(--card);
  padding: 0 1.25rem;
  transition: border-color 0.2s ease;
}

.crm-faq-item.is-open {
  border-color: color-mix(in oklch, var(--primary) 40%, transparent);
}

.crm-faq-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 0;
  background: transparent;
  border: none;
  text-align: left;
  cursor: pointer;
}

.crm-faq-question {
  font-size: 1.0625rem;
  font-weight: 500;
  color: var(--foreground);
}

.crm-faq-trigger:hover .crm-faq-question {
  color: var(--primary);
}

.crm-faq-toggle-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 9999px;
  border: 1px solid var(--border);
  color: var(--foreground);
  flex-shrink: 0;
  transition: all 0.25s ease;
}

.crm-faq-item.is-open .crm-faq-toggle-icon {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--primary-foreground);
  transform: rotate(45deg);
}

.crm-faq-answer {
  padding-bottom: 1.5rem;
  color: var(--muted-foreground);
  font-size: 0.9375rem;
  line-height: 1.6;
}

.crm-faq-answer p {
  margin: 0;
}

/* Security Banner */
.crm-security-banner {
  padding: 3.5rem 1.5rem;
  text-align: center;
  overflow: hidden;
  border-radius: 1rem;
}

.crm-security-ambient {
  position: absolute;
  top: -12rem;
  left: 50%;
  transform: translateX(-50%);
  width: 30rem;
  height: 30rem;
  border-radius: 9999px;
  background: radial-gradient(circle, color-mix(in oklch, var(--primary) 22%, transparent), transparent 70%);
  pointer-events: none;
  z-index: 1;
}

.crm-security-banner > * {
  position: relative;
  z-index: 2;
}

.justify-center {
  justify-content: center;
}

.text-center {
  text-align: center;
  margin-left: auto;
  margin-right: auto;
}

.crm-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  background: var(--muted);
  color: var(--muted-foreground);
  border: 1px solid var(--border);
}

.crm-security-tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
  list-style: none;
  padding: 0;
  margin: 1.5rem 0 0;
}

.crm-security-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 2rem;
}
</style>
