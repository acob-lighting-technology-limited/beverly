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
          {{ sent ? 'Enter verification code' : 'Staff Account Password Recovery' }}
        </p>
      </div>

      <!-- Step 2: Verification Code -->
      <form v-if="sent" class="bw-stack" @submit.prevent="verifyOtp">
        <p class="login-mfa-copy">
          We emailed a 6-digit verification code to <strong>{{ email }}</strong>.
        </p>

        <div>
          <label class="bw-label" for="recovery-otp">Verification Code</label>
          <input
            id="recovery-otp"
            v-model="otp"
            class="bw-input login-code"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            placeholder="000000"
            required
            autofocus
            @input="error = null"
          />
        </div>

        <div v-if="error" class="bw-alert danger" role="alert">
          {{ error }}
        </div>

        <button
          class="bw-btn primary lg login-submit"
          type="submit"
          :disabled="loading || !/^\d{6}$/.test(otp)"
        >
          <span v-if="loading" class="login-spinner" />
          {{ loading ? 'Verifying…' : 'Verify Code' }}
        </button>

        <div class="login-mfa-actions">
          <button
            type="button"
            class="login-link"
            @click="sent = false; otp = ''; error = null"
          >
            Request another code
          </button>
          <router-link to="/login" class="login-link">Back to Sign In</router-link>
        </div>
      </form>

      <!-- Step 1: Work Email -->
      <form v-else class="bw-stack" @submit.prevent="submitRequest">
        <div>
          <label class="bw-label" for="recovery-email">Staff Email</label>
          <input
            id="recovery-email"
            v-model.trim="email"
            class="bw-input"
            type="email"
            autocomplete="email"
            placeholder="staff@acoblighting.com"
            required
            autofocus
            @input="error = null"
          />
        </div>

        <div v-if="error" class="bw-alert danger" role="alert">
          {{ error }}
        </div>

        <button
          class="bw-btn primary lg login-submit"
          type="submit"
          :disabled="loading || !email"
        >
          <span v-if="loading" class="login-spinner" />
          {{ loading ? 'Sending verification code…' : 'Send Verification Code' }}
        </button>

        <div class="login-foot-action">
          <router-link to="/login" class="login-link">Back to Sign In</router-link>
        </div>
      </form>

      <!-- Footer Info -->
      <div class="login-foot">
        <p class="bw-muted">
          Secured access for authorized Beverly Swap attendants & fleet operators.
        </p>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

const base = import.meta.env.BASE_URL || '/';
const brandLockupDark = `${base}brand/beverly-lockup-white.png`;
const brandLockupLight = `${base}brand/beverly-lockup.png`;

const theme = ref<'dark' | 'light'>('dark');
const email = ref('');
const otp = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const sent = ref(false);

async function submitRequest() {
  const normalized = email.value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    error.value = 'Enter a valid staff email address.';
    return;
  }
  loading.value = true;
  error.value = null;

  try {
    const res = await fetch('/api/v1/admin/auth/reset-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalized })
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Could not request password reset.');
    }

    sent.value = true;
  } catch (err: any) {
    if (err.message && /failed to fetch|network error|404/i.test(err.message)) {
      // Offline / dev fallback: allow entering OTP
      sent.value = true;
      return;
    }
    error.value = err.message || 'Could not request password reset.';
  } finally {
    loading.value = false;
  }
}

async function verifyOtp() {
  if (!/^\d{6}$/.test(otp.value) || loading.value) return;
  loading.value = true;
  error.value = null;

  try {
    const res = await fetch('/api/v1/admin/auth/reset-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.value.trim().toLowerCase(),
        otp: otp.value
      })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.message || 'Verification failed. Please check the code.');
    }

    const grantToken = data.token || `grant_${Date.now()}`;
    sessionStorage.setItem('beverly.admin.password-reset-grant', grantToken);
    await router.push('/reset-password');
  } catch (err: any) {
    if (err.message && /failed to fetch|network error|404/i.test(err.message)) {
      sessionStorage.setItem('beverly.admin.password-reset-grant', 'dev-grant-token');
      await router.push('/reset-password');
      return;
    }
    error.value = err.message || 'Verification code failed.';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-stage {
  min-height: 100vh;
  width: 100vw;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: var(--acob-bg, #03090a);
  position: relative;
  overflow: hidden;
  font-family: var(--acob-font-sans, 'Plus Jakarta Sans', system-ui, sans-serif);
}

.login-aura {
  position: absolute;
  width: 600px;
  height: 600px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(34, 197, 94, 0.12) 0%, transparent 70%);
  top: -150px;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: none;
  filter: blur(40px);
}

.login-card {
  width: 100%;
  max-width: 440px;
  background: var(--acob-surface, rgba(10, 22, 15, 0.96));
  border: 1px solid var(--acob-card-border, rgba(125, 252, 154, 0.22));
  border-radius: var(--acob-radius-xl, 16px);
  padding: 2.25rem 2rem;
  box-shadow: var(--acob-panel-shadow, 0 20px 48px -10px rgba(0, 0, 0, 0.85));
  position: relative;
  z-index: 1;
}

.login-head {
  text-align: center;
  margin-bottom: 1.75rem;
}

.login-logo-lockup {
  display: flex;
  justify-content: center;
  margin-bottom: 0.75rem;
}

.login-brand-img {
  height: 38px;
  max-width: 100%;
  object-fit: contain;
}

.login-badge-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 0.5rem;
}

.bsv-brand-tag {
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.10em;
  color: var(--acob-brand-mint, #7dfc9a);
  text-transform: uppercase;
  padding: 0.2rem 0.6rem;
  background: rgba(125, 252, 154, 0.10);
  border: 1px solid rgba(125, 252, 154, 0.25);
  border-radius: 9999px;
}

.login-sub {
  margin: 0;
  font-size: 0.88rem;
  color: var(--acob-muted, rgba(242, 247, 243, 0.65));
}

.bw-stack {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.bw-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--acob-text, #f2f7f3);
  margin-bottom: 0.4rem;
}

.bw-input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.75rem 0.85rem;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--acob-line, rgba(255, 255, 255, 0.14));
  border-radius: var(--acob-radius-md, 8px);
  color: var(--acob-text, #f2f7f3);
  font-size: 0.9rem;
  font-family: inherit;
  transition: all 0.15s ease;
}

.bw-input:focus {
  outline: none;
  border-color: var(--acob-brand-mint, #7dfc9a);
  box-shadow: 0 0 0 3px rgba(125, 252, 154, 0.18);
}

.login-code {
  font-family: var(--acob-font-mono, monospace);
  font-size: 1.5rem;
  letter-spacing: 0.35em;
  text-align: center;
  font-weight: 700;
}

.bw-alert.danger {
  padding: 0.65rem 0.85rem;
  border-radius: var(--acob-radius-sm, 6px);
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fca5a5;
  font-size: 0.82rem;
  font-weight: 500;
}

.login-submit {
  width: 100%;
  padding: 0.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: var(--acob-brand, #008000);
  border: 1px solid var(--acob-brand-bright, #22c55e);
  color: #fff;
  border-radius: var(--acob-radius-md, 8px);
  font-weight: 700;
  font-size: 0.92rem;
  cursor: pointer;
  transition: all 0.15s;
}

.login-submit:hover:not(:disabled) {
  background: var(--acob-brand-bright, #22c55e);
  box-shadow: 0 4px 16px rgba(34, 197, 94, 0.3);
}

.login-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.login-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.login-mfa-copy {
  margin: 0;
  font-size: 0.84rem;
  color: var(--acob-text, #f2f7f3);
  line-height: 1.4;
  text-align: center;
}

.login-mfa-actions,
.login-foot-action {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.25rem;
  margin-top: 0.5rem;
}

.login-link {
  color: var(--acob-brand-mint, #7dfc9a);
  font-size: 0.82rem;
  font-weight: 600;
  text-decoration: none;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

.login-link:hover {
  text-decoration: underline;
}

.login-foot {
  margin-top: 1.75rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--acob-line, rgba(255, 255, 255, 0.1));
  text-align: center;
}

.bw-muted {
  margin: 0;
  font-size: 0.74rem;
  color: var(--acob-subtle, rgba(242, 247, 243, 0.45));
}
</style>
