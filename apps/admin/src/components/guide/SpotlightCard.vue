<script setup lang="ts">
import { ref } from 'vue';

const cardRef = ref<HTMLElement | null>(null);
const spotlightX = ref(-400);
const spotlightY = ref(-400);
const tiltX = ref(0);
const tiltY = ref(0);
const isHovered = ref(false);

function handlePointerMove(e: PointerEvent) {
  if (e.pointerType === 'touch') return;
  const card = cardRef.value;
  if (!card) return;

  const rect = card.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  spotlightX.value = x;
  spotlightY.value = y;

  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  // Maximum tilt ±5 degrees for smooth subtle response
  tiltX.value = -((y - centerY) / centerY) * 4;
  tiltY.value = ((x - centerX) / centerX) * 4;
}

function handlePointerEnter() {
  isHovered.value = true;
}

function handlePointerLeave() {
  isHovered.value = false;
  spotlightX.value = -400;
  spotlightY.value = -400;
  tiltX.value = 0;
  tiltY.value = 0;
}
</script>

<template>
  <div
    ref="cardRef"
    class="guide-spotlight-card group"
    :class="{ 'is-hovered': isHovered }"
    :style="{
      '--spotlight-x': `${spotlightX}px`,
      '--spotlight-y': `${spotlightY}px`,
      '--tilt-x': `${tiltX}deg`,
      '--tilt-y': `${tiltY}deg`,
    }"
    @pointermove="handlePointerMove"
    @pointerenter="handlePointerEnter"
    @pointerleave="handlePointerLeave"
  >
    <div class="guide-spotlight-glow" aria-hidden="true" />
    <div class="guide-spotlight-content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.guide-spotlight-card {
  position: relative;
  overflow: hidden;
  border-radius: 0.75rem;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--card-foreground);
  transform-style: preserve-3d;
  perspective: 1000px;
  transition: border-color 0.25s ease, box-shadow 0.25s ease, transform 0.2s cubic-bezier(0.2, 0.8, 0.4, 1);
}

.guide-spotlight-card.is-hovered {
  border-color: color-mix(in oklch, var(--primary) 40%, transparent);
  box-shadow: 0 12px 30px -10px rgba(0, 0, 0, 0.15);
  transform: perspective(1000px) rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg)) translateY(-2px);
}

.guide-spotlight-glow {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(
    360px circle at var(--spotlight-x, -400px) var(--spotlight-y, -400px),
    color-mix(in oklch, var(--primary) 22%, transparent),
    transparent 65%
  );
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: 1;
}

.guide-spotlight-card.is-hovered .guide-spotlight-glow {
  opacity: 1;
}

.guide-spotlight-content {
  position: relative;
  z-index: 2;
  height: 100%;
}

@media (prefers-reduced-motion: reduce) {
  .guide-spotlight-card {
    transform: none !important;
    transition: border-color 0.2s ease !important;
  }
  .guide-spotlight-glow {
    display: none !important;
  }
}
</style>
