<script setup lang="ts">
import CustomerAuthShell from '../components/CustomerAuthShell.vue';
import { PORTAL_URLS } from '../lib/portals';
</script>

<template>
  <CustomerAuthShell title="What brings you to Beverly?" subtitle="Choose a path. You can finish the essentials first." hide-legal>
    <div class="welcome-signal" aria-hidden="true">
      <span>⚡</span><i /><span>₦</span>
    </div>

    <div class="path-stack" aria-label="Choose account type">
      <router-link class="path-card path-card--customer" to="/signup">
        <span class="path-icon" aria-hidden="true">⌁</span>
        <span class="path-copy">
          <strong>Buy electricity</strong>
          <small>Manage meters, tokens, and payments.</small>
        </span>
        <span class="path-arrow" aria-hidden="true">→</span>
        <span class="path-note">Start free · Tier 0</span>
      </router-link>

      <a class="path-card" :href="`${PORTAL_URLS.vendor}login`">
        <span class="path-icon" aria-hidden="true">▦</span>
        <span class="path-copy">
          <strong>Vend electricity</strong>
          <small>Run your store, wallet, and vending desk.</small>
        </span>
        <span class="path-arrow" aria-hidden="true">→</span>
        <span class="path-note">Business verification required</span>
      </a>
    </div>

    <div class="trust-strip" role="note">
      <span aria-hidden="true">✓</span>
      <p>Your data stays protected. Upgrade only when your limits need it.</p>
    </div>

    <p class="welcome-login">Already registered? <router-link to="/login">Sign in</router-link></p>
  </CustomerAuthShell>
</template>

<style scoped>
.welcome-signal { display:flex; align-items:center; justify-content:center; gap:12px; margin:-2px 0 8px; color:var(--brand); font-size:20px; }
.welcome-signal i { width:44px; height:1px; background:linear-gradient(90deg, transparent, var(--brand), transparent); }
.path-stack { display:grid; gap:12px; }
.path-card { position:relative; display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:12px; align-items:center; min-height:98px; padding:16px; overflow:hidden; border:1px solid var(--border); border-radius:var(--r-xl); color:var(--text); background:var(--surface-2); text-decoration:none; transition:transform var(--dur-fast), border-color var(--dur-fast), background var(--dur-fast); }
.path-card::after { content:""; position:absolute; inset:0; opacity:0; background:linear-gradient(125deg, oklch(from var(--brand) l c h / .13), transparent 55%); transition:opacity var(--dur-fast); pointer-events:none; }
.path-card:hover { transform:translateY(-2px); border-color:var(--brand); }
.path-card:hover::after { opacity:1; }
.path-card:focus-visible { outline:3px solid var(--brand); outline-offset:3px; }
.path-card--customer { border-color:oklch(from var(--brand) l c h / .48); }
.path-icon { display:grid; width:42px; height:42px; place-items:center; border-radius:14px; color:var(--brand); background:oklch(from var(--brand) l c h / .12); font-size:22px; font-weight:800; }
.path-copy, .path-arrow, .path-note { position:relative; z-index:1; }
.path-copy { display:grid; gap:4px; }
.path-copy strong { font-size:var(--t-md); letter-spacing:-.01em; }
.path-copy small { color:var(--text-2); font-size:var(--t-xs); line-height:1.4; }
.path-arrow { color:var(--brand); font-size:21px; }
.path-note { grid-column:2 / -1; color:var(--text-2); font-size:10px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; }
.trust-strip { display:flex; gap:9px; align-items:flex-start; margin-top:4px; padding:12px; border-left:2px solid var(--brand); background:oklch(from var(--brand) l c h / .07); color:var(--text-2); font-size:var(--t-xs); line-height:1.45; }
.trust-strip span { color:var(--brand); font-weight:900; }.trust-strip p { margin:0; }.welcome-login { margin:4px 0 0; color:var(--text-2); font-size:var(--t-sm); text-align:center; }.welcome-login a { color:var(--brand); font-weight:700; text-decoration:none; }
@media (prefers-reduced-motion: reduce) { .path-card, .path-card::after { transition:none; } .path-card:hover { transform:none; } }
</style>
