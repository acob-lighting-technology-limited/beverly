<script setup lang="ts">
import Icon from '@/components/Icon.vue'

export type ViewMode = 'cards' | 'table'
defineProps<{ modelValue: ViewMode }>()
const emit = defineEmits<{ 'update:modelValue': [v: ViewMode] }>()
</script>

<template>
  <div class="vt" role="group" aria-label="View">
    <button type="button" :class="{ on: modelValue === 'cards' }" aria-label="Card view" title="Card view" :aria-pressed="modelValue === 'cards'" @click="emit('update:modelValue', 'cards')"><Icon name="grid" /></button>
    <button type="button" :class="{ on: modelValue === 'table' }" aria-label="Table view" title="Table view" :aria-pressed="modelValue === 'table'" @click="emit('update:modelValue', 'table')"><Icon name="x-list" /></button>
  </div>
</template>
