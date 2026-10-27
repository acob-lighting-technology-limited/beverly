<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';

const props = withDefaults(
  defineProps<{
    delay?: number;
    y?: number;
    blur?: number;
  }>(),
  {
    delay: 0,
    y: 20,
    blur: 6,
  }
);

const isVisible = ref(false);
const elRef = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;

onMounted(() => {
  if (typeof window === 'undefined') return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    isVisible.value = true;
    return;
  }

  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          isVisible.value = true;
          observer?.disconnect();
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
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
  <div
    ref="elRef"
    class="guide-reveal"
    :class="{ 'is-visible': isVisible }"
    :style="{
      '--reveal-delay': `${delay}s`,
      '--reveal-y': `${y}px`,
      '--reveal-blur': `${blur}px`,
    }"
  >
    <slot />
  </div>
</template>

<style scoped>
.guide-reveal {
  opacity: 0;
  transform: translateY(var(--reveal-y, 20px));
  filter: blur(var(--reveal-blur, 6px));
  transition: opacity 0.65s cubic-bezier(0.22, 1, 0.36, 1) var(--reveal-delay, 0s),
              transform 0.65s cubic-bezier(0.22, 1, 0.36, 1) var(--reveal-delay, 0s),
              filter 0.65s cubic-bezier(0.22, 1, 0.36, 1) var(--reveal-delay, 0s);
  will-change: opacity, transform, filter;
}

.guide-reveal.is-visible {
  opacity: 1;
  transform: translateY(0);
  filter: blur(0);
}

@media (prefers-reduced-motion: reduce) {
  .guide-reveal {
    opacity: 1 !important;
    transform: none !important;
    filter: none !important;
    transition: none !important;
  }
}
</style>
