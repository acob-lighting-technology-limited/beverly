<script setup lang="ts">
defineProps<{ name: string }>()
</script>

<template>
  <svg class="i" aria-hidden="true"><use :href="`/icons.svg#${name}`" /></svg>
</template>
