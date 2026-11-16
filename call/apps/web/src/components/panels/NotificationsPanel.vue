<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '@/components/Icon.vue'
import { useInbox } from '@/stores/inbox'
import { useUi } from '@/stores/ui'
import { shortDate } from '@/lib/format'

const inbox = useInbox()
const ui = useUi()
const router = useRouter()
const tab = ref<'all' | 'unread'>('all')
const list = computed(() => inbox.items.filter((n) => tab.value === 'all' || n.unread))
const ICON: Record<string, string> = { esc: 'alert', cb: 'clock', sys: 'bolt' }

async function open(key: string, link: string | null): Promise<void> {
  await inbox.markRead([key])
  ui.close()
  if (link) void router.push(link)
}
</script>

<template>
  <div v-if="ui.panel === 'notifications'" class="np on" role="dialog" aria-label="Notifications" @click.stop>
    <div class="nph"><b>Notifications</b><span v-if="inbox.unread" class="pill vi">{{ inbox.unread }} new</span>
      <button class="tx" :disabled="!inbox.unread" @click="inbox.markRead()">Mark all read</button></div>
    <div class="npt"><button :class="{ on: tab === 'all' }" @click="tab = 'all'">All</button><button :class="{ on: tab === 'unread' }" @click="tab = 'unread'">Unread</button></div>
    <div class="npl">
      <button v-for="n in list" :key="n.key" class="ni" :class="{ u: n.unread }" @click="open(n.key, n.link)">
        <span class="ic" :class="n.tone"><Icon :name="ICON[n.category] ?? 'bolt'" /></span>
        <span class="tt2"><b>{{ n.title }}</b><span v-if="n.body">{{ n.body }}</span></span>
        <small>{{ shortDate(n.at) }}</small><i class="ud"></i>
      </button>
      <div v-if="!list.length" class="npe">{{ inbox.loaded ? 'You are all caught up.' : 'Loading…' }}</div>
    </div>
    <div class="npf"><button @click="ui.open('settings')"><Icon name="sliders" />Notification settings</button></div>
  </div>
</template>
