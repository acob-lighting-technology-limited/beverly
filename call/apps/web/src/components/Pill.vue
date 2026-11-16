<script setup lang="ts">
/** Status pill. `tone` is a semantic class from lib/tones (ok, bad, ye, vi). */
defineProps<{ tone?: string }>()
</script>

<template><span class="pill" :class="tone"><slot /></span></template>
