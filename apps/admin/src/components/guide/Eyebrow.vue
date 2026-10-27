<script setup lang="ts">
withDefaults(
  defineProps<{
    as?: string;
  }>(),
  {
    as: 'p',
  }
);
</script>

<template>
  <component
    :is="as"
    class="guide-eyebrow inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-primary"
  >
    <span
      class="guide-eyebrow-accent inline-block h-3 w-1 -skew-x-[35deg] rounded-sm bg-primary"
      aria-hidden="true"
    />
    <slot />
  </component>
</template>

<style scoped>
.guide-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.125em;
  color: var(--primary);
  margin: 0;
}

.guide-eyebrow-accent {
  display: inline-block;
  height: 0.75rem;
  width: 0.25rem;
  transform: skewX(-35deg);
  border-radius: 0.125rem;
  background: var(--primary);
  flex-shrink: 0;
}
</style>
