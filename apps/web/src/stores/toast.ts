import { defineStore } from 'pinia'
import { ref } from 'vue'

/** One short message at a time, announced to screen readers through an aria-live region in App.vue. */
export const useToast = defineStore('toast', () => {
  const message = ref('')
  let timer = 0
  function show(m: string, ms = 2200): void {
    message.value = m
    clearTimeout(timer)
    timer = window.setTimeout(() => { message.value = '' }, ms)
  }
  return { message, show }
})
