<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

const props = withDefaults(defineProps<{ text: string; delay?: number }>(), { delay: 0 });
const el = ref<HTMLElement | null>(null);
const on = ref(false);
const words = computed(() => props.text.split(' '));

onMounted(() => {
  const rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (rm || !('IntersectionObserver' in window)) {
    on.value = true;
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    if (entries[0]?.isIntersecting) {
      on.value = true;
      observer.disconnect();
    }
  }, { threshold: 0.1 });
  if (el.value) observer.observe(el.value);
});
</script>

<template>
  <span ref="el" class="mask" :class="{ in: on }" :aria-label="text">
    <span v-for="(w, i) in words" :key="i" class="mw" aria-hidden="true">
      <span class="mi" :style="{ transitionDelay: `${delay + i * 70}ms` }">{{ w }}</span>
    </span>
  </span>
</template>
