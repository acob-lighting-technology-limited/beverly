<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';

const props = withDefaults(defineProps<{ to: number; suffix?: string }>(), { to: 0, suffix: '' });
const el = ref<HTMLElement | null>(null);
const v = ref(0);
let started = false;

function run(a: number, b: number) {
  const rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (rm) {
    v.value = b;
    return;
  }
  const t0 = performance.now();
  function f(t: number) {
    const k = Math.min(1, (t - t0) / 1100);
    v.value = Math.round(a + (b - a) * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(f);
  }
  requestAnimationFrame(f);
}

onMounted(() => {
  const rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (rm || !('IntersectionObserver' in window)) {
    started = true;
    run(0, props.to);
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    if (entries[0]?.isIntersecting) {
      started = true;
      run(0, props.to);
      observer.disconnect();
    }
  }, { threshold: 0.1 });
  if (el.value) observer.observe(el.value);
});

watch(() => props.to, (newVal) => {
  if (started) run(v.value, newVal);
});
</script>

<template>
  <span ref="el">{{ v }}{{ suffix }}</span>
</template>
