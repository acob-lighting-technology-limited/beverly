<script setup lang="ts">
/** Main navigation: rail on desktop, bottom bar on mobile, plus the section sub-navigation.
 *  Depends on: session (reachable screens), settings (language), roles (GROUPS).
 *  Used by: App.vue. */
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import Icon from '@/components/Icon.vue'
import { useSession } from '@/stores/session'
import { useSettings } from '@/stores/settings'
import { GROUPS } from '@/lib/roles'
import { groupLabel, screenTitle } from '@/lib/i18n'
import type { ScreenId } from '@/types'

const route = useRoute()
const session = useSession()
const settings = useSettings()

const current = computed(() => route.meta.screen as ScreenId | undefined)
const groupIdx = computed(() => GROUPS.findIndex((g) => current.value && g.screens.includes(current.value)))
const groups = computed(() => GROUPS.map((g, i) => ({ ...g, i, reachable: g.screens.filter((s) => session.screens.includes(s)) })).filter((g) => g.reachable.length))
const subnav = computed(() => (groupIdx.value > 0 ? GROUPS[groupIdx.value]!.screens.filter((s) => session.screens.includes(s)) : []))
/** Agents have only their own cases under Monitor, so the tab says so. */
const navLabel = (i: number): string => (session.role === 'agent' && GROUPS[i]?.label === 'Monitor' ? 'Cases' : groupLabel(settings.p.lang, i))
const mark = computed(() => (settings.isDark() ? '/brand/beverly-mark-light.png' : '/brand/beverly-mark.png'))
</script>

<template>
  <nav aria-label="Main">
    <img class="bmark rail-logo" :src="mark" alt="Beverly" />
    <RouterLink v-for="g in groups" :key="g.label" :to="`/${g.reachable[0]}`" :class="{ on: g.i === groupIdx }" :title="navLabel(g.i)" :aria-label="navLabel(g.i)" :aria-current="g.i === groupIdx ? 'page' : undefined">
      <Icon :name="g.icon" /><span>{{ navLabel(g.i) }}</span>
    </RouterLink>
  </nav>
  <div class="subnav" :class="{ on: subnav.length > 1 }" role="navigation" aria-label="Section">
    <RouterLink v-for="s in subnav" :key="s" :to="`/${s}`" :class="{ on: s === current }" :aria-current="s === current ? 'page' : undefined">{{ screenTitle(settings.p.lang, s) }}</RouterLink>
  </div>
</template>
