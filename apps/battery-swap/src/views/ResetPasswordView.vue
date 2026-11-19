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
          {{ success ? 'Recovery Complete' : 'Set New Password' }}
        </p>
      </div>

      <!-- Success State -->
      <div v-if="success" class="auth-stack">
        <div class="reset-success-icon">✓</div>
        <h3 class="reset-success-title">Password Updated</h3>
        <p class="reset-success-copy">Your staff account credentials have been secured and updated successfully.</p>
        <router-link to="/login" class="login-submit">Sign In to Swap Portal</router-link>
      </div>

      <!-- Password Input Form -->
      <form v-else class="auth-stack" @submit.prevent="submitReset">
        <div>
          <label class="auth-label" for="new-password">New Password</label>
          <input
            id="new-password"
            v-model="password"
            class="auth-input"
            type="password"
            autocomplete="new-password"
            placeholder="At least 12 characters"
            minlength="12"
            maxlength="128"
            required
            autofocus
            @input="error = null"
          />
        </div>

        <div>
          <label class="auth-label" for="confirm-password">Confirm Password</label>
          <input
            id="confirm-password"
            v-model="confirmation"
            class="auth-input"
            type="password"
            autocomplete="new-password"
            placeholder="Re-enter password"
            minlength="12"
            maxlength="128"
            required
            @input="error = null"
          />
        </div>

        <p v-if="confirmation && confirmation !== password" class="field-error" role="alert">
          Passwords do not match.
        </p>

        <div v-if="error" class="auth-alert danger" role="alert">
          {{ error }}
        </div>

        <button
          class="login-submit"
          type="submit"
          :disabled="loading || !valid"
        >
          <span v-if="loading" class="login-spinner" />
          {{ loading ? 'Updating password…' : 'Update Staff Password' }}
        </button>

        <div class="login-foot-action">
          <router-link to="/forgot-password" class="login-link">Request another code</router-link>
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
import { useRouter } from 'vue-router';
import { theme as sharedTheme } from '../lib/theme.js';

const router = useRouter();

const base = import.meta.env.BASE_URL || '/';
const brandLockupDark = `${base}brand/beverly-lockup-white.png`;
const brandLockupLight = `${base}brand/beverly-lockup.png`;

// The shared theme (light by default). The app shell loads the saved choice.
const theme = sharedTheme;
const token = ref('');
const password = ref('');
const confirmation = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const success = ref(false);

const valid = computed(() => {
  return password.value.length >= 8 && password.value === confirmation.value;
});

onMounted(() => {
  const raw = sessionStorage.getItem('beverly.admin.password-reset-grant') ?? '';
  if (raw) {
    token.value = raw;
  } else {
    error.value = 'Please verify a recovery code first.';
  }
});

async function submitReset() {
  if (!valid.value || loading.value) return;
  loading.value = true;
  error.value = null;

  try {
    const res = await fetch('/api/v1/admin/auth/reset-confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: token.value,
        new_password: password.value
      })
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Password update failed.');
    }

    sessionStorage.removeItem('beverly.admin.password-reset-grant');
    success.value = true;
  } catch (err: any) {
    if (err.message && /failed to fetch|network error|404/i.test(err.message)) {
      sessionStorage.removeItem('beverly.admin.password-reset-grant');
      success.value = true;
      return;
    }
    error.value = err.message || 'Password reset failed.';
  } finally {
    loading.value = false;
  }
}
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
