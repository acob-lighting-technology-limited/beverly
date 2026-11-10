<script setup lang="ts">
import { ref, onMounted } from 'vue';

const props = withDefaults(defineProps<{ delay?: number }>(), { delay: 0 });
const el = ref<HTMLElement | null>(null);
const on = ref(false);

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
  <div ref="el" class="reveal" :class="{ in: on }" :style="{ transitionDelay: `${delay}ms` }">
    <slot />
  </div>
</template>
