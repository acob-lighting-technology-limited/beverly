<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';

const props = withDefaults(
  defineProps<{
    to: number | string;
    suffix?: string;
    duration?: number;
  }>(),
  {
    suffix: '',
    duration: 1.6,
  }
);

const displayValue = ref<number | string>(0);
const elRef = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;
let hasAnimated = false;

function animateCount(target: number) {
  const startTime = performance.now();
  const durationMs = props.duration * 1000;

  function step(currentTime: number) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / durationMs, 1);
    // Standard easeOutExpo curve
    const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    displayValue.value = Math.floor(eased * target);

    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      displayValue.value = target;
    }
  }

  requestAnimationFrame(step);
}

onMounted(() => {
  if (typeof props.to !== 'number') {
    displayValue.value = props.to;
    return;
  }

  if (typeof window === 'undefined') return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    displayValue.value = props.to;
    return;
  }

  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !hasAnimated) {
          hasAnimated = true;
          animateCount(props.to as number);
          observer?.disconnect();
        }
      });
    },
    { threshold: 0.2 }
  );

  if (elRef.value) {
    observer.observe(elRef.value);
  }
});

onBeforeUnmount(() => {
  observer?.disconnect();
});
</script>

<template>
  <span ref="elRef" class="guide-count-up font-mono">
    <span>{{ displayValue }}</span>
    <span v-if="suffix" class="guide-count-suffix">{{ suffix }}</span>
  </span>
</template>

<style scoped>
.guide-count-up {
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);
  display: inline-flex;
  align-items: baseline;
}

.guide-count-suffix {
  font-size: 0.8em;
  margin-left: 0.05em;
  color: var(--primary);
}
</style>
