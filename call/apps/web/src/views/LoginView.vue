<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSession } from '@/stores/session'
import { DEFAULT_SCREEN } from '@/lib/roles'

const session = useSession()
const router = useRouter()
const email = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  error.value = ''
  busy.value = true
  try {
    await session.login(email.value.trim(), password.value)
    if (session.user) router.replace(`/${DEFAULT_SCREEN[session.user.role]}`)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Sign-in failed.'
  } finally {
    password.value = ''
    busy.value = false
  }
}
</script>

<template>
  <main class="login">
    <form class="c" style="width: min(380px, 92vw); display: grid; gap: 10px" @submit.prevent="submit">
      <h1 style="font-weight: 300; margin: 0">Beverly Call</h1>
      <p style="color: var(--mut); margin: 0">Sign in with your Beverly staff account.</p>
      <label class="fl">Email<input v-model="email" type="email" autocomplete="username" required /></label>
      <label class="fl">Password<input v-model="password" type="password" autocomplete="current-password" required /></label>
      <div v-if="error" class="ban" role="alert" style="background: var(--bad); color: var(--badt)">{{ error }}</div>
      <button class="y" type="submit" :disabled="busy">{{ busy ? 'Signing in…' : 'Sign in' }}</button>
    </form>
  </main>
</template>

<style scoped>
.login { min-height: 100dvh; display: grid; place-items: center; padding: 16px; background: linear-gradient(135deg, var(--g1), var(--g2) 60%, var(--g3)); }
</style>
