<template>
  <div class="period" role="radiogroup" aria-label="Period">
    <button v-for="d in PERIODS" :key="d" type="button" role="radio" :aria-checked="modelValue === d" :class="{ on: modelValue === d }" :data-testid="`period-${d}`" @click="$emit('update:modelValue', d)">
      {{ d }} days
    </button>
  </div>
</template>

<script setup>
/** Chooses how many days an analytics screen covers. The styles are in styles/dashboard.css. */
import { PERIODS } from "../stores/pue-analytics-store.js";

defineProps({ modelValue: { type: Number, required: true } });
defineEmits(["update:modelValue"]);
</script>
