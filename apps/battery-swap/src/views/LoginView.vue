<template>
  <main class="login-stage">

    <div class="auth-card login-card">
      <div class="login-head">
        <div class="login-logo-lockup">
          <img
            :src="theme === 'dark' ? brandLockupDark : brandLockupLight"
            alt="Beverly"
            class="login-brand-img"
          />
        </div>
        <h1 class="login-title">Beverly PUE</h1>
        <p class="auth-muted login-sub">
          {{ step === 'challenge' ? 'Two-Factor Authentication' : 'Your Smart Power Partner.' }}
        </p>
      </div>

      <!-- Step 1: Staff Email + Password -->
      <form v-if="step === 'password'" class="auth-stack" @submit.prevent="signIn">
        <div>
          <label class="auth-label">Staff Email</label>
          <input
            v-model.trim="email"
            class="auth-input"
            type="email"
            autocomplete="username"
            placeholder="staff@acoblighting.com"
            required
            @input="error = null"
          />
        </div>

        <div>
          <label class="auth-label">Password</label>
          <div class="password-field">
            <input
              v-model="password"
              class="auth-input"
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
          <router-link to="/forgot-password" class="login-link">Forgot password?</router-link>
        </div>

        <div v-if="error" class="auth-alert danger" role="alert">
          {{ error }}
        </div>

        <button
          class="login-submit"
          type="submit"
          :disabled="loading || !email || !password"
        >
          <span v-if="loading" class="login-spinner" />
          {{ loading ? 'Signing in…' : 'Sign In to Swap Portal' }}
        </button>
      </form>

      <!-- Step 2: MFA Challenge -->
      <form v-else class="auth-stack" @submit.prevent="verifyChallenge">
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
          class="auth-input login-code"
          :inputmode="useRecovery ? 'text' : 'numeric'"
          autocomplete="one-time-code"
          :maxlength="useRecovery ? 14 : 6"
          :placeholder="useRecovery ? 'XXXX-XXXX-XXXX' : '000000'"
          autofocus
          @keyup.enter="verifyChallenge"
        />

        <div v-if="error" class="auth-alert danger" role="alert">
          {{ error }}
        </div>

        <button class="login-submit" type="submit" :disabled="loading || !challengeCode">
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
        <p class="auth-muted">
          Secured access for authorized Beverly Swap attendants & fleet operators.
        </p>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { theme as sharedTheme } from '../lib/theme.js';
import { startSessionKeeper } from '../lib/session.js';
import { PUE_PORTAL_HEADERS, useBatterySwapAuthStore } from '../stores/auth';

const REMEMBERED_EMAIL_KEY = 'beverly.battery_swap.remembered_email';
const base = import.meta.env.BASE_URL || '/';
const brandLockupDark = `${base}brand/beverly-lockup-white.png`;
const brandLockupLight = `${base}brand/beverly-lockup.png`;

const route = useRoute();
const router = useRouter();
const auth = useBatterySwapAuthStore();

// The shared theme (light by default). The app shell loads the saved choice.
const theme = sharedTheme;
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
  return '/hub';
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
      headers: { 'Content-Type': 'application/json', ...PUE_PORTAL_HEADERS },
      // The backend checks users.portal_access includes 'pue'.
      body: JSON.stringify({ email: normalizedEmail, password: password.value, portal: 'pue' })
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
      station_id: data.user?.station_id || null,
      portal_access: Array.isArray(data.user?.portal_access) ? data.user.portal_access : []
    }, { refreshToken: data.refresh_token ?? null, expiresAt: typeof data.expires_at === 'number' ? data.expires_at : null });
    startSessionKeeper();

    if (rememberEmail.value) {
      localStorage.setItem(REMEMBERED_EMAIL_KEY, normalizedEmail);
    } else {
      localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    }

    playLoginVoice();
    await router.push(redirectTarget.value);
  } catch (err: any) {
    // No offline fallback session: a network failure must never sign anyone in.
    error.value = err instanceof TypeError
      ? 'Cannot reach the Beverly sign-in service. Check your connection and try again.'
      : err.message || 'Authentication failed. Please verify credentials.';
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
        ...PUE_PORTAL_HEADERS,
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
    const rememberedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY);
    if (rememberedEmail) {
      email.value = rememberedEmail;
      rememberEmail.value = true;
    }
  } catch {}

  auth.hydrate();
  if (route.query.expired === '1' || auth.sessionExpired) {
    error.value = 'Your session expired. Sign in again.';
    auth.sessionExpired = false;
  }
  if (auth.isAuthenticated) {
    router.replace(redirectTarget.value);
  }
});
</script>

<style scoped>
.login-stage {
  position: relative; min-height: 100dvh; display: grid; place-items: center; padding: 1.5rem;
  font-family: var(--acob-font-sans, inherit); color: var(--acob-text);
}

.login-card {
  position: relative; width: 100%; max-width: 440px; padding: 2.5rem 2.25rem 2rem; border-radius: 34px;
  background: linear-gradient(135deg, var(--lg-fill-strong), var(--lg-fill) 70%);
  border: 1px solid var(--lg-border);
  box-shadow: inset 0 1px 0 var(--lg-rim-top), inset 0 -1px 0 var(--lg-rim-bottom), var(--lg-shadow);
  -webkit-backdrop-filter: var(--lg-blur); backdrop-filter: var(--lg-blur);
  animation: login-rise .6s cubic-bezier(.16, 1, .3, 1);
}
@keyframes login-rise { from { opacity: 0; transform: translateY(18px) scale(.97); } }

.login-head { text-align: center; margin-bottom: 1.75rem; }
.login-logo-lockup { display: flex; justify-content: center; align-items: center; margin-bottom: 1rem; }
.login-brand-img { height: 34px; max-width: 190px; object-fit: contain; }
.login-title { margin: 0; font-size: 30px; font-weight: 750; letter-spacing: -.035em; }
.login-sub { margin: .4rem 0 0; font-size: 15px; color: var(--acob-muted); }

.auth-stack { display: flex; flex-direction: column; gap: 1.1rem; }
.auth-label { display: block; font-size: 13px; font-weight: 700; color: var(--acob-text); margin-bottom: .45rem; }

.auth-input {
  width: 100%; height: 50px; padding: 0 1.1rem; box-sizing: border-box; font: inherit; font-size: 15px; color: var(--acob-text);
  background: var(--lg-fill-inset); border: 1px solid var(--lg-border); border-radius: 999px;
  box-shadow: inset 0 2px 5px rgba(var(--gel-shade-rgb), .14), inset 0 -1px 0 var(--lg-rim-top);
  transition: box-shadow .2s ease;
}
.auth-input::placeholder { color: var(--acob-subtle); }
.auth-input:focus { outline: none; box-shadow: inset 0 2px 5px rgba(var(--gel-shade-rgb), .14), 0 0 0 3px color-mix(in srgb, var(--acob-focus) 40%, transparent); }

.password-field { position: relative; }
.password-field .auth-input { padding-right: 78px; }
.password-toggle { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); border: none; background: transparent; color: var(--acob-accent); font-weight: 700; font-size: 13px; cursor: pointer; padding: 6px 8px; }

.login-row { display: flex; align-items: center; justify-content: space-between; gap: .75rem; font-size: 13px; }
.login-check { display: inline-flex; align-items: center; gap: 8px; color: var(--acob-muted); cursor: pointer; }
.login-link { color: var(--acob-accent); text-decoration: none; font-weight: 650; font-size: 13px; background: none; border: none; cursor: pointer; padding: 0; }
.login-link:hover { text-decoration: underline; text-underline-offset: 3px; }

.auth-alert.danger {
  padding: .75rem 1rem; font-size: 13px; border-radius: 18px; color: var(--acob-text);
  background: color-mix(in srgb, var(--danger) 14%, var(--lg-fill)); border: 1px solid color-mix(in srgb, var(--danger) 45%, transparent);
}

.login-submit {
  width: 100%; min-height: 52px; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer;
  border: 1px solid var(--lg-border); border-radius: 999px; font: inherit; font-weight: 750; font-size: 15px; color: var(--on-gel);
  background: var(--gel-mid);
  box-shadow: none;
  transition: transform .3s cubic-bezier(.16, 1, .3, 1), filter .2s ease;
}
.login-submit:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.06); }
.login-submit:active:not(:disabled) { transform: scale(.98); }
.login-submit:disabled { opacity: .6; cursor: not-allowed; }

.login-mfa-icon { width: 60px; height: 60px; margin: 0 auto; display: grid; place-items: center; border-radius: 18px; color: var(--acob-accent); background: var(--lg-fill-inset); border: 1px solid var(--lg-border); box-shadow: inset 0 1px 0 var(--lg-rim-top); }
.login-mfa-copy { text-align: center; color: var(--acob-muted); font-size: 14px; margin: 0; line-height: 1.5; }
.login-code { text-align: center; font-size: 26px; letter-spacing: .25em; font-family: var(--acob-font-mono, monospace); font-weight: 700; }
.login-mfa-actions { display: flex; justify-content: space-between; gap: .75rem; }

.login-foot { text-align: center; margin-top: 1.75rem; padding-top: 1.25rem; border-top: 1px solid var(--acob-line); font-size: 13px; }
.login-foot p { margin: 0 0 .5rem; color: var(--acob-muted); }
.login-ecosystem-links { display: flex; justify-content: center; align-items: center; gap: 8px; }
.login-foot-link { color: var(--acob-accent); text-decoration: none; font-weight: 650; }
.login-foot-link:hover { text-decoration: underline; text-underline-offset: 3px; }
.foot-sep { color: var(--acob-subtle); }

@media (prefers-reduced-motion: reduce) { .login-card { animation: none; } .login-submit { transition: none; } }

.login-spinner { width: 16px; height: 16px; border: 2px solid rgba(31, 31, 34, .25); border-top-color: var(--on-gel); border-radius: 50%; animation: login-spin .7s linear infinite; }
@keyframes login-spin { to { transform: rotate(360deg); } }
.login-foot-action { display: flex; justify-content: center; margin-top: .25rem; }
.field-error { margin: .4rem 0 0 .4rem; color: var(--danger); font-size: 13px; }
.reset-success-icon { width: 68px; height: 68px; margin: 0 auto 1rem; display: grid; place-items: center; border-radius: 50%; color: var(--on-gel); background: var(--gel-mid); box-shadow: none; }
.reset-success-title { margin: 0 0 .5rem; text-align: center; font-size: 26px; font-weight: 750; letter-spacing: -.03em; }
.reset-success-copy { margin: 0 0 1.25rem; text-align: center; color: var(--acob-muted); line-height: 1.5; }
</style>
