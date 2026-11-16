import type { Directive } from 'vue'

interface State { target: number; raf: number; move: (e: PointerEvent) => void; leave: () => void }
const states = new WeakMap<HTMLElement, State>()

/**
 * Hides the scrollbar and slides a horizontal strip toward the pointer: hover the left edge to see the start,
 * the right edge to see the end. Touch devices keep native swiping. Respects reduced motion by jumping instead of gliding.
 */
export const vHoverScroll: Directive<HTMLElement> = {
  mounted(el) {
    el.classList.add('hs')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const s: State = {
      target: el.scrollLeft, raf: 0,
      move: (e) => {
        if (e.pointerType === 'touch') return
        const max = el.scrollWidth - el.clientWidth
        if (max <= 0) return
        const r = el.getBoundingClientRect()
        const t = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
        // dead zone in the middle third so the strip does not drift while reading
        const eased = t < 0.33 ? 0 : t > 0.67 ? 1 : (t - 0.33) / 0.34
        s.target = eased * max
        if (reduce) { el.scrollLeft = s.target; return }
        if (!s.raf) s.raf = requestAnimationFrame(function step() {
          const d = s.target - el.scrollLeft
          if (Math.abs(d) < 1) { el.scrollLeft = s.target; s.raf = 0; return }
          el.scrollLeft += d * 0.12
          s.raf = requestAnimationFrame(step)
        })
      },
      leave: () => { cancelAnimationFrame(s.raf); s.raf = 0 },
    }
    el.addEventListener('pointermove', s.move)
    el.addEventListener('pointerleave', s.leave)
    states.set(el, s)
  },
  unmounted(el) {
    const s = states.get(el)
    if (!s) return
    cancelAnimationFrame(s.raf)
    el.removeEventListener('pointermove', s.move)
    el.removeEventListener('pointerleave', s.leave)
    states.delete(el)
  },
}
