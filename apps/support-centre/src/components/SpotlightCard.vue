<script setup lang="ts">
import { ref } from 'vue';

const el = ref<HTMLElement | null>(null);
let raf = 0;

function mv(e: PointerEvent) {
  if (window.matchMedia('(hover: none)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !el.value) return;
  const r = el.value.getBoundingClientRect();
  const x = e.clientX - r.left;
  const y = e.clientY - r.top;
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    if (!el.value) return;
    const s = el.value.style;
    s.setProperty('--spotlight-x', `${x}px`);
    s.setProperty('--spotlight-y', `${y}px`);
    s.transform = `perspective(900px) rotateX(${((0.5 - y / r.height) * 4)}deg) rotateY(${((x / r.width - 0.5) * 4)}deg)`;
  });
}

function lv() {
  if (!el.value) return;
  cancelAnimationFrame(raf);
  el.value.style.transform = '';
  el.value.style.setProperty('--spotlight-x', '-400px');
}
</script>

<template>
  <div ref="el" class="spot" @pointermove="mv" @pointerleave="lv">
    <div class="glow"></div>
    <div class="sc"><slot /></div>
  </div>
</template>
