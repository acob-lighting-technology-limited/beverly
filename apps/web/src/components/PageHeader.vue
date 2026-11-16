<script setup lang="ts">
/** Sticky screen header: title row (leading control, actions) plus an optional KPI strip in the default slot.
 *  Used by: every view under views/. */
defineProps<{ title: string }>()
</script>

<template>
  <div class="head">
    <div class="ht"><slot name="leading" /><h1>{{ title }}</h1><slot name="actions" /></div>
    <slot />
  </div>
</template>
