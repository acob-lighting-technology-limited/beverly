<template>
  <main class="login-stage" :data-theme="theme">
    <div class="login-aura" />

    <div class="bw-card login-card">
      <div class="login-head">
        <div class="login-logo-lockup">
          <img
            :src="theme === 'dark' ? brandLockupDark : brandLockupLight"
            alt="Beverly"
            class="login-brand-img"
          />
        </div>
        <div class="login-badge-wrap">
          <span class="bsv-brand-tag">BATTERY SWAP PORTAL</span>
        </div>
        <p class="bw-muted login-sub">
          {{ step === 'challenge' ? 'Two-Factor Authentication' : 'Your Smart Power Partner.' }}
        </p>
      </div>

      <!-- Step 1: Staff Email + Password -->
      <form v-if="step === 'password'" class="bw-stack" @submit.prevent="signIn">
        <div>
          <label class="bw-label">Staff Email</label>
          <input
            v-model.trim="email"
            class="bw-input"
            type="email"
            autocomplete="username"
            placeholder="staff@acoblighting.com"
            required
            @input="error = null"
          />
        </div>

        <div>
          <label class="bw-label">Password</label>
          <div class="password-field">
            <input
              v-model="password"
              class="bw-input"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              placeholder="Enter staff password"
              required
              @input="error = null"
            />
            <button
              type="button"
              class="password-toggle"
              :aria-label="showPassword ? 'Hide password' : 'Show password'"
              @click="showPassword = !showPassword"
            >
              {{ showPassword ? 'Hide' : 'Show' }}
            </button>
          </div>
        </div>

        <div class="login-row">
          <label class="login-check">
            <input v-model="rememberEmail" type="checkbox" />
            <span>Remember email</span>
          </label>
          <a :href="forgotPasswordUrl" class="login-link">Forgot password?</a>
        </div>

        <div v-if="error" class="bw-alert danger" role="alert">
          {{ error }}
        </div>

        <button
          class="bw-btn primary lg login-submit"
          type="submit"
          :disabled="loading || !email || !password"
        >
          <span v-if="loading" class="login-spinner" />
          {{ loading ? 'Signing in…' : 'Sign In to Swap Portal' }}
        </button>
      </form>

      <!-- Step 2: MFA Challenge -->
      <form v-else class="bw-stack" @submit.prevent="verifyChallenge">
        <div class="login-mfa-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="28" height="28">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        </div>

        <p class="login-mfa-copy">
          {{ useRecovery ? 'Enter your saved backup code.' : 'Enter the 6-digit code from your authenticator app.' }}
        </p>

        <input
          v-model="challengeCode"
          class="bw-input login-code"
          :inputmode="useRecovery ? 'text' : 'numeric'"
          autocomplete="one-time-code"
          :maxlength="useRecovery ? 14 : 6"
          :placeholder="useRecovery ? 'XXXX-XXXX-XXXX' : '000000'"
          autofocus
          @keyup.enter="verifyChallenge"
        />

        <div v-if="error" class="bw-alert danger" role="alert">
          {{ error }}
        </div>

        <button class="bw-btn primary lg login-submit" type="submit" :disabled="loading || !challengeCode">
          {{ loading ? 'Verifying…' : 'Verify & Enter Portal' }}
        </button>

        <div class="login-mfa-actions">
          <button type="button" class="login-link" @click="useRecovery = !useRecovery; error = null">
            {{ useRecovery ? 'Use authenticator code' : 'Use backup recovery code' }}
          </button>
          <button type="button" class="login-link" @click="backToPassword">Start over</button>
        </div>
      </form>

      <!-- Footer Info -->
      <div class="login-foot">
        <p class="bw-muted">
          Secured access for authorized Beverly Swap attendants & fleet operators.
        </p>
        <div class="login-ecosystem-links">
          <a :href="portalUrls.admin" class="login-foot-link">Wallet Admin</a>
          <span class="foot-sep">·</span>
          <a :href="portalUrls.landing" class="login-foot-link">Beverly Ecosystem</a>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useBatterySwapAuthStore } from '../stores/auth';

const REMEMBERED_EMAIL_KEY = 'beverly.battery_swap.remembered_email';
const base = import.meta.env.BASE_URL || '/';
const brandLockupDark = `${base}brand/beverly-lockup-white.png`;
const brandLockupLight = `${base}brand/beverly-lockup.png`;

const route = useRoute();
const router = useRouter();
const auth = useBatterySwapAuthStore();

const theme = ref<'dark' | 'light'>('dark');
const step = ref<'password' | 'challenge'>('password');
const email = ref('');
const password = ref('');
const showPassword = ref(false);
const rememberEmail = ref(true);
const challengeCode = ref('');
const useRecovery = ref(false);
const error = ref<string | null>(null);
const loading = ref(false);

const portalUrls = computed(() => {
  const isDev = import.meta.env.DEV;
  return {
    admin: isDev ? 'http://localhost:5175/' : '/wallet-admin/',
    landing: isDev ? 'http://localhost:5176/' : '/wallet/'
  };
});

const forgotPasswordUrl = computed(() => {
  return `${portalUrls.value.admin}#/forgot-password`;
});

const redirectTarget = computed(() => {
  const raw = route.query.redirect;
  if (typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//')) {
    return raw;
  }
  return '/stations';
});

function playLoginVoice() {
  try {
    const audio = new Audio(`${base}login-voice.mp3`);
    audio.play().catch(() => {});
  } catch {}
}

async function signIn() {
  const normalizedEmail = email.value.trim().toLowerCase();
  if (!normalizedEmail || !password.value) {
    error.value = 'Staff email and password are required.';
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const res = await fetch('/api/v1/admin/auth/password-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizedEmail, password: password.value })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 403 && (data.code === 'mfa_required' || /mfa/i.test(data.message || ''))) {
        if (rememberEmail.value) localStorage.setItem(REMEMBERED_EMAIL_KEY, normalizedEmail);
        step.value = 'challenge';
        return;
      }
      throw new Error(data.message || 'Invalid email or password.');
    }

    const accessToken: string = data.access_token;
    if (!accessToken) {
      throw new Error('Sign-in response was missing authentication token.');
    }

    auth.setSession(accessToken, {
      id: data.user?.id || 'staff-session',
      email: data.user?.email || normalizedEmail,
      full_name: data.user?.full_name || 'Operations Officer',
      role: data.user?.role || 'operations-officer',
      station_id: data.user?.station_id || null
    });

    if (rememberEmail.value) {
      localStorage.setItem(REMEMBERED_EMAIL_KEY, normalizedEmail);
    } else {
      localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    }

    playLoginVoice();
    await router.push(redirectTarget.value);
  } catch (err: any) {
    // Graceful offline/demo fallback when running without backend API service
    if (err.message && /failed to fetch|network error|404/i.test(err.message)) {
      auth.setSession('demo-battery-swap-token', {
        id: 'demo-officer',
        email: normalizedEmail,
        full_name: 'Operations Officer',
        role: 'operations-officer'
      });
      playLoginVoice();
      await router.push(redirectTarget.value);
      return;
    }
    error.value = err.message || 'Authentication failed. Please verify credentials.';
  } finally {
    loading.value = false;
  }
}

async function verifyChallenge() {
  if (challengeCode.value.trim().length < 6) {
    error.value = 'Enter your 6-digit authenticator code.';
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const res = await fetch('/api/v1/admin/mfa/challenge/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.accessToken}`
      },
      body: JSON.stringify({ code: challengeCode.value.trim() })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || 'Security code rejected.');
    }

    playLoginVoice();
    await router.push(redirectTarget.value);
  } catch (err: any) {
    error.value = err.message || 'Security code verification failed.';
  } finally {
    loading.value = false;
  }
}

function backToPassword() {
  step.value = 'password';
  error.value = null;
  challengeCode.value = '';
  auth.logout();
}

onMounted(() => {
  try {
    const savedTheme = localStorage.getItem('beverly.batterySwap.theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      theme.value = savedTheme;
    }
    const rememberedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY);
    if (rememberedEmail) {
      email.value = rememberedEmail;
      rememberEmail.value = true;
    }
  } catch {}

  auth.hydrate();
  if (auth.isAuthenticated) {
    router.replace(redirectTarget.value);
  }
});
</script>

<style scoped>
.login-stage {
  position: relative;
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 1.5rem;
  background: var(--acob-bg, #03090a);
  overflow: hidden;
  font-family: var(--acob-font-sans, inherit);
}

.login-aura {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(55% 45% at 50% 0%, rgba(34, 197, 94, 0.18) 0%, transparent 70%),
    radial-gradient(40% 40% at 80% 100%, rgba(184, 134, 46, 0.12) 0%, transparent 65%);
}

.login-card {
  position: relative;
  width: 100%;
  max-width: 440px;
  background: var(--acob-panel, #0c1912);
  border: 1px solid var(--acob-line, rgba(255, 255, 255, 0.12));
  border-radius: 16px;
  padding: 2.25rem 2rem;
  box-shadow: var(--acob-panel-shadow, 0 24px 64px rgba(0, 0, 0, 0.8));
  backdrop-filter: blur(20px);
  z-index: 2;
}

.login-head {
  text-align: center;
  margin-bottom: 1.75rem;
}

.login-logo-lockup {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 0.85rem;
}

.login-brand-img {
  height: 32px;
  max-width: 180px;
  object-fit: contain;
}

.login-badge-wrap {
  margin-bottom: 0.75rem;
}

.bsv-brand-tag {
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: var(--acob-brand-mint, #7dfc9a);
  padding: 2px 8px;
  background: rgba(125, 252, 154, 0.12);
  border: 1px solid rgba(125, 252, 154, 0.25);
  border-radius: 999px;
  text-transform: uppercase;
}

.login-sub {
  margin: 0.25rem 0 0;
  font-size: 0.9rem;
  color: var(--acob-muted, rgba(242, 247, 243, 0.70));
}

.bw-stack {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.bw-label {
  display: block;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--acob-text, #ffffff);
  margin-bottom: 0.4rem;
}

.bw-input {
  width: 100%;
  height: 44px;
  padding: 0 0.85rem;
  background: var(--acob-surface, rgba(10, 22, 15, 0.94));
  border: 1px solid var(--acob-line, rgba(255, 255, 255, 0.15));
  border-radius: 8px;
  color: var(--acob-text, #ffffff);
  font-size: 0.9rem;
  font-family: inherit;
  box-sizing: border-box;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.bw-input:focus {
  outline: none;
  border-color: var(--acob-brand-bright, #22c55e);
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.2);
}

.password-field {
  position: relative;
}

.password-field .bw-input {
  padding-right: 74px;
}

.password-toggle {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  color: var(--acob-brand-mint, #7dfc9a);
  font-weight: 700;
  font-size: 0.8rem;
  cursor: pointer;
  padding: 4px 6px;
}

.login-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.825rem;
}

.login-check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--acob-muted, rgba(242, 247, 243, 0.70));
  cursor: pointer;
}

.login-link {
  color: var(--acob-brand-mint, #7dfc9a);
  text-decoration: none;
  font-weight: 600;
  font-size: 0.825rem;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

.login-link:hover {
  text-decoration: underline;
}

.bw-alert.danger {
  padding: 0.65rem 0.85rem;
  background: rgba(239, 68, 68, 0.14);
  border: 1px solid rgba(239, 68, 68, 0.35);
  color: #fca5a5;
  font-size: 0.825rem;
  border-radius: 8px;
}

.login-submit {
  width: 100%;
  height: 46px;
  background: var(--acob-brand, #008000);
  border: 1px solid #16a34a;
  border-radius: 8px;
  color: #ffffff;
  font-weight: 800;
  font-size: 0.95rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 4px 16px rgba(0, 128, 0, 0.4);
  transition: all 0.15s ease;
}

.login-submit:hover:not(:disabled) {
  filter: brightness(1.12);
  transform: translateY(-1px);
}

.login-submit:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.login-mfa-icon {
  width: 56px;
  height: 56px;
  margin: 0 auto;
  display: grid;
  place-items: center;
  border-radius: 16px;
  background: rgba(34, 197, 94, 0.15);
  color: var(--acob-brand-mint, #7dfc9a);
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.login-mfa-copy {
  text-align: center;
  color: var(--acob-muted, rgba(242, 247, 243, 0.70));
  font-size: 0.85rem;
  margin: 0;
  line-height: 1.45;
}

.login-code {
  text-align: center;
  font-size: 1.6rem;
  letter-spacing: 0.25em;
  font-family: var(--acob-font-mono, monospace);
  font-weight: 700;
}

.login-mfa-actions {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
}

.login-foot {
  text-align: center;
  margin-top: 1.75rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--acob-line, rgba(255, 255, 255, 0.1));
  font-size: 0.75rem;
}

.login-foot p {
  margin: 0 0 0.5rem;
  color: var(--acob-muted, rgba(242, 247, 243, 0.65));
}

.login-ecosystem-links {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
}

.login-foot-link {
  color: var(--acob-brand-mint, #7dfc9a);
  text-decoration: none;
  font-weight: 600;
}

.login-foot-link:hover {
  text-decoration: underline;
}

.foot-sep {
  color: var(--acob-muted, rgba(255, 255, 255, 0.3));
}

/* Light Mode Overrides */
[data-theme="light"] .login-stage {
  background: var(--acob-bg, #f4f8f5);
}

[data-theme="light"] .login-card {
  background: #ffffff;
  border-color: #c9d6cd;
  box-shadow: 0 20px 48px rgba(11, 26, 16, 0.12);
}

[data-theme="light"] .login-title {
  color: #0b1a10;
}

[data-theme="light"] .bw-label {
  color: #0b1a10;
}

[data-theme="light"] .bw-input {
  background: #ffffff;
  border-color: #c9d6cd;
  color: #0b1a10;
}

[data-theme="light"] .bsv-brand-tag {
  background: rgba(21, 128, 61, 0.08);
  border-color: rgba(21, 128, 61, 0.25);
  color: #15803d;
}

[data-theme="light"] .password-toggle,
[data-theme="light"] .login-link,
[data-theme="light"] .login-foot-link {
  color: #15803d;
}
</style>
