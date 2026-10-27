<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';

const props = withDefaults(
  defineProps<{
    text: string;
    as?: string;
    delay?: number;
    stagger?: number;
  }>(),
  {
    as: 'h1',
    delay: 0,
    stagger: 0.04,
  }
);

const words = computed(() => props.text.split(' '));
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
    { threshold: 0.1 }
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
  <component
    :is="as"
    ref="elRef"
    class="guide-mask-text"
    :aria-label="text"
  >
    <span
      v-for="(word, i) in words"
      :key="`${word}-${i}`"
      class="guide-mask-word-wrap"
      aria-hidden="true"
    >
      <span
        class="guide-mask-word"
        :class="{ 'is-visible': isVisible }"
        :style="{
          '--word-delay': `${delay + i * stagger}s`,
        }"
      >{{ word }}</span>
      <span class="guide-mask-space">&nbsp;</span>
    </span>
  </component>
</template>

<style scoped>
.guide-mask-text {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  margin: 0;
}

.guide-mask-word-wrap {
  display: inline-flex;
  overflow: hidden;
  vertical-align: bottom;
}

.guide-mask-word {
  display: inline-block;
  transform: translateY(115%) rotate(3deg);
  opacity: 0;
  transition: transform 0.75s cubic-bezier(0.16, 1, 0.3, 1) var(--word-delay, 0s),
              opacity 0.5s ease var(--word-delay, 0s);
  will-change: transform, opacity;
}

.guide-mask-word.is-visible {
  transform: translateY(0) rotate(0deg);
  opacity: 1;
}

.guide-mask-space {
  display: inline-block;
}

@media (prefers-reduced-motion: reduce) {
  .guide-mask-word {
    transform: none !important;
    opacity: 1 !important;
    transition: none !important;
  }
}
</style>
