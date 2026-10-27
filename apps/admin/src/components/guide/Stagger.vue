<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';

const props = withDefaults(
  defineProps<{
    stagger?: number;
    delay?: number;
  }>(),
  {
    stagger: 0.05,
    delay: 0,
  }
);

const containerRef = ref<HTMLElement | null>(null);
const isVisible = ref(false);
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
    { threshold: 0.1 }
  );

  if (containerRef.value) {
    observer.observe(containerRef.value);
  }
});

onBeforeUnmount(() => {
  observer?.disconnect();
});
</script>

<template>
  <div
    ref="containerRef"
    class="guide-stagger"
    :class="{ 'is-visible': isVisible }"
    :style="{
      '--stagger-delay': `${delay}s`,
      '--stagger-interval': `${stagger}s`,
    }"
  >
    <slot />
  </div>
</template>

<style scoped>
.guide-stagger {
  display: contents;
}

:deep(.guide-stagger-item) {
  opacity: 0;
  transform: translateY(16px);
  transition: opacity 0.5s cubic-bezier(0.2, 0.8, 0.4, 1),
              transform 0.5s cubic-bezier(0.2, 0.8, 0.4, 1);
}

.guide-stagger.is-visible :deep(.guide-stagger-item) {
  opacity: 1;
  transform: translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  :deep(.guide-stagger-item) {
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
  }
}
</style>
