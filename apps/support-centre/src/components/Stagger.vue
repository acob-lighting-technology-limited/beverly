<script setup lang="ts">
import { ref, onMounted, onUpdated } from 'vue';

const el = ref<HTMLElement | null>(null);
const on = ref(false);

function applyIdx() {
  if (!el.value) return;
  Array.prototype.forEach.call(el.value.children, (child: HTMLElement, i: number) => {
    child.style.setProperty('--i', String(i));
  });
}

onMounted(() => {
  applyIdx();
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

onUpdated(applyIdx);
</script>

<template>
  <div ref="el" class="stagger" :class="{ in: on }">
    <slot />
  </div>
</template>
