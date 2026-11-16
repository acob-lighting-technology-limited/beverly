<script setup lang="ts">
defineProps<{ loading: boolean; error: string; what: string }>()
</script>

<template>
  <div v-if="loading" class="ban">Loading {{ what }}…</div>
  <div v-else-if="error" class="ban" role="alert" style="background: var(--bad); color: var(--badt)">{{ error }}</div>
</template>
