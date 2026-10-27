<script setup lang="ts">
import { ref, computed } from 'vue';
import AppShell from '../components/AppShell.vue';
import Eyebrow from '../components/guide/Eyebrow.vue';
import Reveal from '../components/guide/Reveal.vue';
import MaskText from '../components/guide/MaskText.vue';
import SpotlightCard from '../components/guide/SpotlightCard.vue';
import CountUp from '../components/guide/CountUp.vue';
import Stagger from '../components/guide/Stagger.vue';
import {
  guideStats,
  guideStory,
  guideModuleGroups,
  guideHighlights,
  firstWeekSteps,
  guideFaqGroups,
  securityPoints,
  type GuideFaqGroup,
} from '../lib/guide/content';
import { useStaffAuthStore } from '../stores/auth';
import '../styles/guide-tokens.css';

const auth = useStaffAuthStore();

const userFirstName = computed(() => {
  const full = auth.user?.full_name || '';
  if (full) {
    const first = full.trim().split(/\s+/)[0];
    return first ? first.charAt(0).toUpperCase() + first.slice(1) : '';
  }
  const emailPart = auth.user?.email?.split('@')[0] || '';
  if (!emailPart) return '';
  return emailPart.charAt(0).toUpperCase() + emailPart.slice(1);
});

// Dynamic Extra Access based on permissions
const extraModules = computed(() => {
  const extras: Array<{ name: string; href: string; summary: string; icon: string }> = [];

  if (auth.hasPermission('dev.console')) {
    extras.push({
      name: 'Developer Console',
      href: '/dev/api-keys',
      icon: 'dev-api-keys',
      summary: 'Manage OEM adapters, API keys, webhooks, sandbox simulation, and system diagnostics.',
    });
  }
  if (auth.hasPermission('wallet.kyc.view')) {
    extras.push({
      name: 'KYC Reviews',
      href: '/kyc-reviews',
      icon: 'kyc',
      summary: 'Review customer and vendor identity documents, address verification, and compliance tiers.',
    });
  }
  if (auth.hasPermission('wallet.funding.manage')) {
    extras.push({
      name: 'Funding Approvals',
      href: '/funding',
      icon: 'funding',
      summary: 'Approve or reject merchant wallet funding requests and Paystack payment references.',
    });
  }
  if (auth.hasPermission('wallet.audit.view')) {
    extras.push({
      name: 'System Audit Log',
      href: '/audit',
      icon: 'audit',
      summary: 'Full immutable trace of administrator operations, balance overrides, and role changes.',
    });
  }

  return extras;
});

// Interactive FAQ State
const activeFaqTab = ref(guideFaqGroups[0]?.id || 'account');
const openQuestion = ref<string | null>(guideFaqGroups[0]?.items[0]?.q || null);

const currentFaqGroup = computed<GuideFaqGroup>(() => {
  return guideFaqGroups.find((g) => g.id === activeFaqTab.value) || guideFaqGroups[0];
});

function toggleQuestion(q: string) {
  openQuestion.value = openQuestion.value === q ? null : q;
}

function selectFaqTab(id: string) {
  activeFaqTab.value = id;
  const grp = guideFaqGroups.find((g) => g.id === id);
  openQuestion.value = grp?.items[0]?.q || null;
}
</script>

<template>
  <AppShell>
    <div class="guide-scope min-h-screen">
      <div class="guide-container">
        <!-- 1. Hero Section -->
        <section class="guide-hero-section relative overflow-hidden rounded-2xl border border-border bg-card p-6 sm:p-12 mb-16">
          <div class="guide-hero-ambient" aria-hidden="true" />
          <div class="guide-hero-grid guide-grid-pattern" aria-hidden="true" />

          <div class="relative z-10 max-w-3xl">
            <Eyebrow>
              {{ userFirstName ? `Welcome, ${userFirstName}` : 'Beverly Guide' }}
            </Eyebrow>

            <MaskText
              text="One grid. Every energy workflow."
              as="h1"
              class="guide-h1 font-bold tracking-tight text-foreground"
              :delay="0.1"
            />

            <Reveal :delay="0.3">
              <p class="guide-lead text-muted-foreground mt-4 sm:mt-6 text-base sm:text-lg">
                Beverly is the operational nervous system for your smart mini-grid infrastructure.
                From Calinmeter and SparkMeter token generation to real-time IoT power quality telemetry and double-entry energy wallets—everything connects here.
              </p>
            </Reveal>

            <Reveal :delay="0.45">
              <div class="mt-8 flex flex-wrap items-center gap-3">
                <a href="#first-week" class="guide-btn-primary">
                  Start here
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </a>
                <a href="#modules" class="guide-btn-outline">
                  Browse modules
                </a>
              </div>
            </Reveal>
          </div>
        </section>

        <!-- 2. Headline Stat Band -->
        <section class="mb-20">
          <div class="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
            <SpotlightCard
              v-for="stat in guideStats"
              :key="stat.label"
              class="p-6 text-center"
            >
              <p class="guide-stat-value text-3xl sm:text-5xl font-bold font-mono tracking-tight text-foreground">
                <CountUp :to="stat.value" :suffix="stat.suffix" />
              </p>
              <p class="guide-stat-label mt-2 text-xs sm:text-sm font-medium text-muted-foreground">
                {{ stat.label }}
              </p>
            </SpotlightCard>
          </div>
        </section>

        <!-- 3. Transformation Story ("Why Beverly") -->
        <section class="mb-24">
          <Reveal>
            <div class="max-w-2xl mb-8">
              <Eyebrow>The shift</Eyebrow>
              <h2 class="guide-h2 text-foreground font-semibold">
                Why mini-grids run on Beverly.
              </h2>
              <p class="guide-lead text-muted-foreground">
                Energy distribution in remote and commercial markets used to mean manual scratch tokens, lost vending slips, and unmetered bypass. Beverly replaces guesswork with certainty.
              </p>
            </div>
          </Reveal>

          <div class="grid gap-6 md:grid-cols-3">
            <SpotlightCard
              v-for="item in guideStory"
              :key="item.kicker"
              class="p-6 flex flex-col justify-between"
            >
              <div>
                <span class="guide-story-pill inline-block px-2.5 py-1 text-xs font-mono font-semibold uppercase tracking-wider rounded-md mb-4" :class="item.kicker === 'Now' ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-muted text-muted-foreground'">
                  {{ item.kicker }}
                </span>
                <h3 class="text-lg font-semibold text-foreground mb-2">
                  {{ item.title }}
                </h3>
                <p class="text-sm text-muted-foreground leading-relaxed">
                  {{ item.body }}
                </p>
              </div>
            </SpotlightCard>
          </div>
        </section>

        <!-- 4. Module Directory ("Your Modules") -->
        <section id="modules" class="scroll-mt-12 mb-24">
          <Reveal>
            <div class="max-w-2xl mb-10">
              <Eyebrow>Module directory</Eyebrow>
              <h2 class="guide-h2 text-foreground font-semibold">
                Your modules.
              </h2>
              <p class="guide-lead text-muted-foreground">
                Every tool is built around an operational task: issuing tokens, balancing feeder meters, reviewing audits, and reconciling daily cash flows.
              </p>
            </div>
          </Reveal>

          <!-- Extra Access Callout (If staff has special elevated capabilities) -->
          <div v-if="extraModules.length" class="mb-12">
            <div class="p-6 rounded-xl border border-primary/30 bg-primary/5 mb-6">
              <div class="flex items-center gap-2 mb-4">
                <span class="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
                <h3 class="font-mono text-xs uppercase tracking-wider font-semibold text-primary">
                  Your Extra Access
                </h3>
              </div>
              <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <router-link
                  v-for="mod in extraModules"
                  :key="mod.name"
                  :to="mod.href"
                  class="group block p-4 rounded-lg bg-card border border-border hover:border-primary/50 transition-colors"
                >
                  <p class="font-semibold text-sm text-foreground group-hover:text-primary transition-colors flex items-center justify-between">
                    {{ mod.name }}
                    <span class="text-muted-foreground group-hover:text-primary transition-transform group-hover:translate-x-0.5">→</span>
                  </p>
                  <p class="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {{ mod.summary }}
                  </p>
                </router-link>
              </div>
            </div>
          </div>

          <!-- Module Groups -->
          <div class="space-y-12">
            <div
              v-for="group in guideModuleGroups"
              :key="group.key"
              class="guide-module-group"
            >
              <div class="flex items-center gap-3 mb-6 pb-2 border-b border-border">
                <span class="inline-block h-2 w-2 rounded-full bg-primary" />
                <h3 class="text-xl font-semibold tracking-tight text-foreground">
                  {{ group.label }}
                </h3>
                <span class="ml-auto font-mono text-xs text-muted-foreground">
                  {{ group.modules.length }} modules
                </span>
              </div>

              <Stagger>
                <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <SpotlightCard
                    v-for="mod in group.modules"
                    :key="mod.name"
                    class="guide-stagger-item group"
                  >
                    <router-link
                      :to="mod.href"
                      class="guide-card-interactive"
                    >
                      <div class="flex items-center justify-between mb-3">
                        <span class="guide-icon-badge">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                            <rect x="3" y="3" width="7" height="7" rx="1.5" />
                            <rect x="14" y="3" width="7" height="7" rx="1.5" />
                            <rect x="3" y="14" width="7" height="7" rx="1.5" />
                            <rect x="14" y="14" width="7" height="7" rx="1.5" />
                          </svg>
                        </span>
                        <span class="text-muted-foreground group-hover:text-primary transition-transform group-hover:translate-x-0.5" aria-hidden="true">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="5" y1="12" x2="19" y2="12" />
                            <polyline points="12 5 19 12 12 19" />
                          </svg>
                        </span>
                      </div>
                      <h4 class="font-semibold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors">
                        {{ mod.name }}
                      </h4>
                      <p class="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                        {{ mod.summary }}
                      </p>
                    </router-link>
                  </SpotlightCard>
                </div>
              </Stagger>
            </div>
          </div>
        </section>

        <!-- 5. Deep Dive Highlights ("How Beverly Works") -->
        <section class="mb-24">
          <Reveal>
            <div class="max-w-2xl mb-10">
              <Eyebrow>Architecture</Eyebrow>
              <h2 class="guide-h2 text-foreground font-semibold">
                Built for mission-critical reliability.
              </h2>
              <p class="guide-lead text-muted-foreground">
                Mini-grids operate in challenging network conditions. Beverly separates offline STS vending from cloud telemetry aggregation so field tokens vend reliably even during internet dropouts.
              </p>
            </div>
          </Reveal>

          <div class="grid gap-8 md:grid-cols-3">
            <SpotlightCard
              v-for="highlight in guideHighlights"
              :key="highlight.tag"
              class="relative overflow-hidden p-8 flex flex-col justify-between"
            >
              <!-- Watermark Icon -->
              <div class="guide-watermark-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </div>

              <div>
                <span class="guide-badge font-mono mb-4">
                  {{ highlight.tag }}
                </span>
                <h3 class="text-xl font-bold text-foreground mb-3 leading-snug">
                  {{ highlight.title }}
                </h3>
                <p class="text-sm text-muted-foreground leading-relaxed mb-6">
                  {{ highlight.body }}
                </p>
              </div>

              <div v-if="highlight.href">
                <router-link
                  :to="highlight.href"
                  class="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  Explore module
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </router-link>
              </div>
            </SpotlightCard>
          </div>
        </section>

        <!-- 6. First-Week Walkthrough ("Start Here") -->
        <section id="first-week" class="scroll-mt-12 mb-24">
          <Reveal>
            <div class="max-w-2xl mb-10">
              <Eyebrow>Start here</Eyebrow>
              <h2 class="guide-h2 text-foreground font-semibold">
                Your first week in Beverly.
              </h2>
              <p class="guide-lead text-muted-foreground">
                Follow this quick sequence to get comfortable navigating your stations, issuing tokens, inspecting feeder demand, and verifying settlement accounts.
              </p>
            </div>
          </Reveal>

          <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <SpotlightCard
              v-for="(step, idx) in firstWeekSteps"
              :key="step.title"
              class="p-6 flex flex-col justify-between"
            >
              <div>
                <span class="guide-step-number font-mono text-xs font-bold text-primary mb-4 block">
                  {{ String(idx + 1).padStart(2, '0') }}
                </span>
                <h4 class="font-semibold text-base text-foreground mb-2">
                  {{ step.title }}
                </h4>
                <p class="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {{ step.body }}
                </p>
              </div>

              <div v-if="step.href && step.cta" class="mt-6 pt-4 border-t border-border">
                <router-link
                  :to="step.href"
                  class="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  {{ step.cta }}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </router-link>
              </div>
            </SpotlightCard>
          </div>
        </section>

        <!-- 7. Interactive FAQ & Support CTA -->
        <section class="mb-24">
          <Reveal>
            <div class="max-w-2xl mb-10">
              <Eyebrow>Questions</Eyebrow>
              <h2 class="guide-h2 text-foreground font-semibold">
                Things people ask.
              </h2>
              <p class="guide-lead text-muted-foreground">
                Common questions about STS tokens, offline operation, relay disconnects, and regulatory compliance.
              </p>
            </div>
          </Reveal>

          <div class="grid gap-8 lg:grid-cols-12">
            <!-- Topic Tabs (Left col) -->
            <div class="lg:col-span-4">
              <div role="tablist" class="flex flex-col gap-2 p-1.5 rounded-xl border border-border bg-card">
                <button
                  v-for="grp in guideFaqGroups"
                  :key="grp.id"
                  role="tab"
                  :aria-selected="grp.id === activeFaqTab"
                  type="button"
                  class="guide-faq-tab flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium text-left transition-colors"
                  :class="grp.id === activeFaqTab ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'"
                  @click="selectFaqTab(grp.id)"
                >
                  <span>{{ grp.title }}</span>
                  <span
                    class="font-mono text-xs px-2 py-0.5 rounded-full"
                    :class="grp.id === activeFaqTab ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'"
                  >
                    {{ grp.items.length }}
                  </span>
                </button>
              </div>
            </div>

            <!-- Accordion Items (Right col) -->
            <div class="lg:col-span-8">
              <div role="tabpanel" class="space-y-3">
                <div
                  v-for="item in currentFaqGroup.items"
                  :key="item.q"
                  class="rounded-xl border border-border bg-card overflow-hidden transition-all"
                  :class="{ 'border-primary/40': openQuestion === item.q }"
                >
                  <button
                    type="button"
                    class="w-full flex items-center justify-between p-5 text-left transition-colors hover:bg-muted/30"
                    :aria-expanded="openQuestion === item.q"
                    @click="toggleQuestion(item.q)"
                  >
                    <span class="text-base font-semibold text-foreground pr-4">
                      {{ item.q }}
                    </span>
                    <span
                      class="flex-shrink-0 w-6 h-6 rounded-full border border-border flex items-center justify-center text-muted-foreground transition-transform duration-200"
                      :class="{ 'rotate-45 bg-primary border-primary text-primary-foreground': openQuestion === item.q }"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </span>
                  </button>

                  <div
                    v-show="openQuestion === item.q"
                    class="px-5 pb-5 text-sm text-muted-foreground leading-relaxed border-t border-border/50 pt-4"
                  >
                    {{ item.a }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Security & Support Banner -->
        <section class="guide-security-section relative overflow-hidden rounded-2xl border border-border bg-card p-8 sm:p-12 text-center">
          <div class="guide-security-ambient" aria-hidden="true" />

          <div class="relative z-10 max-w-2xl mx-auto">
            <Eyebrow class="justify-center mb-3">Secured by design</Eyebrow>
            <h2 class="guide-h2 text-foreground font-semibold mb-3">
              Need a hand? You're covered.
            </h2>
            <p class="guide-lead text-muted-foreground mx-auto mb-8">
              Chat directly with AcoBot for quick answers, or raise a Help Desk ticket when field equipment requires investigation.
              Your data stays protected the whole way.
            </p>

            <ul class="flex flex-wrap justify-center gap-2 mb-8" aria-label="Security standards">
              <li
                v-for="point in securityPoints"
                :key="point"
                class="guide-badge font-mono"
              >
                {{ point }}
              </li>
            </ul>

            <div class="flex flex-wrap justify-center gap-3">
              <router-link to="/support" class="guide-btn-primary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M4 13v-1a8 8 0 0 1 16 0v1" />
                  <path d="M5 13h2a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2Z" />
                  <path d="M19 13h-2a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h1" />
                </svg>
                Raise a support ticket
              </router-link>
              <router-link to="/dashboard" class="guide-btn-outline">
                Back to Dashboard
              </router-link>
            </div>
          </div>
        </section>
      </div>
    </div>
  </AppShell>
</template>

<style scoped>
.guide-hero-section {
  position: relative;
  background: var(--card);
}

.guide-hero-ambient {
  position: absolute;
  top: -12rem;
  right: -10rem;
  width: 36rem;
  height: 36rem;
  border-radius: 9999px;
  background: radial-gradient(circle, color-mix(in oklch, var(--primary) 28%, transparent), transparent 70%);
  pointer-events: none;
  z-index: 1;
}

.guide-hero-grid {
  position: absolute;
  inset: 0;
  opacity: 0.45;
  pointer-events: none;
  z-index: 2;
}

.guide-watermark-icon {
  position: absolute;
  right: -2rem;
  bottom: -2rem;
  width: 12rem;
  height: 12rem;
  color: color-mix(in oklch, var(--primary) 8%, transparent);
  pointer-events: none;
  z-index: 0;
}

.guide-step-number {
  font-size: 0.875rem;
}

.guide-security-section {
  position: relative;
  background: var(--card);
}

.guide-security-ambient {
  position: absolute;
  top: -16rem;
  left: 50%;
  transform: translateX(-50%);
  width: 36rem;
  height: 36rem;
  border-radius: 9999px;
  background: radial-gradient(circle, color-mix(in oklch, var(--primary) 22%, transparent), transparent 70%);
  pointer-events: none;
  z-index: 1;
}

.justify-center {
  justify-content: center;
}
</style>
