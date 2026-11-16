<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import Icon from '@/components/Icon.vue'

const props = defineProps<{ open: boolean; title: string }>()
const emit = defineEmits<{ close: [] }>()
const box = ref<HTMLElement | null>(null)
let returnTo: HTMLElement | null = null

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') { emit('close'); return }
  if (e.key !== 'Tab' || !box.value) return
  const f = [...box.value.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],[tabindex="0"]')].filter((x) => !x.hasAttribute('disabled') && x.offsetParent !== null)
  if (!f.length) return
  const first = f[0]!, last = f[f.length - 1]!
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
}
watch(() => props.open, async (o) => {
  if (o) {
    returnTo = document.activeElement as HTMLElement | null
    document.addEventListener('keydown', onKey)
    await nextTick()
    box.value?.querySelector<HTMLElement>('input:not([type=checkbox]):not([type=range]),textarea,select')?.focus({ preventScroll: true })
  } else {
    document.removeEventListener('keydown', onKey)
    returnTo?.focus?.({ preventScroll: true })
  }
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div class="sp-scrim" :class="{ on: open }" @click="emit('close')"></div>
    <aside ref="box" class="sp" :class="{ on: open }" role="dialog" :aria-label="title" :aria-hidden="!open">
      <header class="sp-h"><b>{{ title }}</b><slot name="head" /><button class="sp-x" aria-label="Close" @click="emit('close')"><Icon name="x" /></button></header>
      <div class="sp-b"><slot v-if="open" /></div>
    </aside>
  </Teleport>
</template>

<style>
.sp-scrim { position: fixed; inset: 0; z-index: 70; background: rgba(0, 0, 0, 0.4); opacity: 0; pointer-events: none; transition: opacity 0.2s; }
.sp-scrim.on { opacity: 1; pointer-events: auto; }
.sp { position: fixed; z-index: 75; left: 0; right: 0; bottom: 0; height: 88dvh; display: flex; flex-direction: column; background: var(--g1); color: var(--ink); border-radius: 28px 28px 0 0; box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.3); transform: translateY(105%); visibility: hidden; transition: transform 0.25s, visibility 0s 0.25s; }
.sp.on { transform: none; visibility: visible; transition: transform 0.25s; }
.sp-h { display: flex; align-items: center; gap: 8px; padding: 14px 14px 8px 20px; }
.sp-h b { flex: 1; font-weight: 400; font-size: 18px; }
.sp-x { width: 36px; height: 36px; min-width: 0; padding: 0; background: var(--panel); }
.sp-b { flex: 1; overflow: auto; padding: 0 16px 20px; }
.sp-b h3 { margin: 16px 0 6px; font-weight: 400; font-size: 13px; color: var(--mut); text-transform: uppercase; letter-spacing: 0.06em; }
@media (min-width: 900px) { .sp { left: auto; top: 0; width: 440px; height: 100dvh; border-radius: 28px 0 0 28px; transform: translateX(105%); } .sp.on { transform: none; } }
@media (prefers-reduced-motion: reduce) { .sp, .sp-scrim { transition: none; } }
</style>
