<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import Icon from '@/components/Icon.vue'

const props = defineProps<{ open: boolean; title: string; wide?: boolean }>()
const emit = defineEmits<{ close: [] }>()
const box = ref<HTMLElement | null>(null)
let returnTo: HTMLElement | null = null

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') { e.stopPropagation(); emit('close'); return }
  if (e.key !== 'Tab' || !box.value) return
  const f = [...box.value.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],[tabindex="0"]')].filter((x) => !x.hasAttribute('disabled') && x.offsetParent !== null)
  if (!f.length) return
  const first = f[0]!, last = f[f.length - 1]!
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
}

// Keyboard users land inside the dialog and return to the control that opened it.
watch(() => props.open, async (o) => {
  if (o) {
    returnTo = document.activeElement as HTMLElement | null
    document.addEventListener('keydown', onKey, true)
    await nextTick()
    box.value?.querySelector<HTMLElement>('[data-autofocus],input,textarea,select,button.y')?.focus({ preventScroll: true })
    ;(box.value?.querySelector('[data-autofocus]') ?? box.value)?.setAttribute?.('tabindex', '-1')
  } else {
    document.removeEventListener('keydown', onKey, true)
    returnTo?.focus?.({ preventScroll: true })
  }
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKey, true))
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="mdl-scrim" @mousedown.self="emit('close')">
      <div ref="box" class="mdl" :class="{ wide }" role="dialog" aria-modal="true" :aria-label="title">
        <header class="mdl-h"><b>{{ title }}</b><button class="mdl-x" aria-label="Close" @click="emit('close')"><Icon name="x" /></button></header>
        <div class="mdl-b"><slot /></div>
        <footer v-if="$slots.footer" class="mdl-f"><slot name="footer" /></footer>
      </div>
    </div>
  </Teleport>
</template>

<style>
.mdl-scrim { position: fixed; inset: 0; z-index: 80; display: grid; place-items: center; padding: 16px; background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(8px); animation: mdl-in 0.16s ease-out; }
.mdl { width: min(460px, 100%); max-height: min(86dvh, 720px); display: flex; flex-direction: column; background: var(--card); color: var(--ink); border-radius: 24px; box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35); overflow: hidden; }
.mdl.wide { width: min(720px, 100%); }
.mdl-h { display: flex; align-items: center; gap: 8px; padding: 14px 16px 8px; }
.mdl-h b { flex: 1; font-weight: 400; font-size: 17px; }
.mdl-x { width: 34px; height: 34px; min-width: 0; padding: 0; background: var(--panel); }
.mdl-b { padding: 4px 16px 16px; overflow: auto; }
.mdl-f { display: flex; gap: 8px; justify-content: flex-end; padding: 10px 16px 14px; border-top: 1px dotted var(--line); }
@keyframes mdl-in { from { opacity: 0; transform: translateY(8px) scale(0.98); } }
@media (prefers-reduced-motion: reduce) { .mdl-scrim { animation: none; } }
</style>
