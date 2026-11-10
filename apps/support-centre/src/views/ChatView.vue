<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { api } from '../lib/api';

// ═══════════════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════════════
interface ChatSession {
  id: string;
  display_name?: string;
  requester_actor_type: string;
  status: string;
  subject?: string;
  unread_for_staff: number;
  last_message_at: string;
}

interface ChatMessage {
  id: string;
  body: string;
  sender_actor_type: string;
  sender_name?: string;
  kind?: string;
  created_at: string;
}

// ═══════════════════════════════════════════════════════════════════════
//  State
// ═══════════════════════════════════════════════════════════════════════
const sessions = ref<ChatSession[]>([]);
const chatStatusFilter = ref('');
const selSession = ref<ChatSession | null>(null);
const chatMessages = ref<ChatMessage[]>([]);
const chatDraft = ref('');
const chatSending = ref(false);
const chatLastTs = ref('');
const chatScroller = ref<HTMLElement | null>(null);
let chatPoll: ReturnType<typeof setInterval> | null = null;
let sessionsPoll: ReturnType<typeof setInterval> | null = null;
let chatFetchInFlight = false;

const waitingCount = ref(0);

// ═══════════════════════════════════════════════════════════════════════
//  API
// ═══════════════════════════════════════════════════════════════════════
function mergeChatMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(current.map(m => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => {
    const byTime = String(a.created_at).localeCompare(String(b.created_at));
    return byTime || String(a.id).localeCompare(String(b.id));
  });
}

async function loadSessions() {
  try {
    const qs = chatStatusFilter.value ? `?status=${chatStatusFilter.value}` : '';
    const res = await api.get<{ sessions: ChatSession[] }>(`/api/v1/admin/support/chat/sessions${qs}`);
    sessions.value = res.sessions ?? [];
    waitingCount.value = sessions.value.filter(s => s.status === 'waiting').length;
  } catch { /* offline */ }
}

async function openSession(s: ChatSession) {
  selSession.value = s;
  chatMessages.value = [];
  chatLastTs.value = '';
  try { await api.post(`/api/v1/admin/support/chat/${s.id}/assign`, {}); } catch { /* ignore */ }
  await fetchChat(true);
  if (chatPoll) clearInterval(chatPoll);
  chatPoll = setInterval(() => fetchChat(false), 4000);
}

async function fetchChat(initial: boolean) {
  if (!selSession.value || chatFetchInFlight) return;
  chatFetchInFlight = true;
  try {
    const q = chatLastTs.value && !initial ? `?since=${encodeURIComponent(chatLastTs.value)}` : '';
    const res = await api.get<{ messages: ChatMessage[] }>(`/api/v1/admin/support/chat/${selSession.value.id}/messages${q}`);
    const incoming = res.messages ?? [];
    chatMessages.value = initial ? mergeChatMessages([], incoming) : mergeChatMessages(chatMessages.value, incoming);
    if (chatMessages.value.length) chatLastTs.value = chatMessages.value[chatMessages.value.length - 1].created_at;
    scrollChat();
  } catch { /* ignore */ } finally { chatFetchInFlight = false; }
}

async function sendChat() {
  if (!selSession.value || !chatDraft.value.trim() || chatSending.value) return;
  const body = chatDraft.value.trim();
  chatSending.value = true;
  try {
    await api.post(`/api/v1/admin/support/chat/${selSession.value.id}/messages`, { body });
    if (chatDraft.value.trim() === body) chatDraft.value = '';
    await fetchChat(false);
  } catch { /* preserve draft */ } finally { chatSending.value = false; }
}

async function endChat() {
  if (!selSession.value) return;
  try {
    await api.post(`/api/v1/admin/support/chat/${selSession.value.id}/end`, {});
    selSession.value = null;
    if (chatPoll) clearInterval(chatPoll);
    await loadSessions();
  } catch { /* ignore */ }
}

function scrollChat() {
  nextTick(() => {
    if (chatScroller.value) chatScroller.value.scrollTop = chatScroller.value.scrollHeight;
  });
}

// ═══════════════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════════════
function statusBadge(s: string): string {
  return ({ active: 'pill-ok', waiting: 'pill-warn', ended: 'pill-dim' } as Record<string, string>)[s] ?? 'pill-dim';
}
function fmt(s: string) { return s ? new Date(s).toLocaleString('en-NG', { timeStyle: 'short', dateStyle: 'short' }) : '—'; }
function displayName(s: ChatSession | null) { return s?.display_name || s?.requester_actor_type || 'Customer'; }

onMounted(async () => {
  await loadSessions();
  sessionsPoll = setInterval(loadSessions, 6000);
});
onBeforeUnmount(() => {
  if (chatPoll) clearInterval(chatPoll);
  if (sessionsPoll) clearInterval(sessionsPoll);
});
</script>

<template>
  <div class="cv-root">

    <!-- ═══ Header strip ═══ -->
    <div class="cv-header">
      <div>
        <h2 class="cv-title">Live Chat</h2>
        <p class="dim small">Real-time customer conversations</p>
      </div>
      <div class="cv-header-meta">
        <span v-if="waitingCount" class="pill pill-warn">{{ waitingCount }} waiting</span>
        <select v-model="chatStatusFilter" class="cv-select cv-select-sm" @change="loadSessions" aria-label="Filter by status">
          <option value="">All</option>
          <option value="waiting">Waiting</option>
          <option value="active">Active</option>
          <option value="ended">Ended</option>
        </select>
        <button class="cv-btn cv-btn-ghost cv-btn-sm" @click="loadSessions">Refresh</button>
      </div>
    </div>

    <!-- ═══ Chat Layout ═══ -->
    <div class="cv-layout">

      <!-- Session List -->
      <aside class="cv-list" aria-label="Chat sessions">
        <button
          v-for="s in sessions"
          :key="s.id"
          :class="['cv-session', selSession?.id === s.id && 'cv-session--on']"
          @click="openSession(s)"
        >
          <div class="cv-session-top">
            <div class="cv-session-av">{{ (displayName(s))[0].toUpperCase() }}</div>
            <div class="cv-session-info">
              <strong>{{ displayName(s) }}</strong>
              <small class="dim">{{ s.subject || s.requester_actor_type }}</small>
            </div>
            <span v-if="s.unread_for_staff" class="cv-unread">{{ s.unread_for_staff }}</span>
          </div>
          <div class="cv-session-foot">
            <span :class="['pill', statusBadge(s.status)]">{{ s.status }}</span>
            <span class="dim xsmall">{{ fmt(s.last_message_at) }}</span>
          </div>
        </button>

        <div v-if="!sessions.length" class="cv-empty">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
          </svg>
          <strong>No live chats</strong>
          <span>Customer chats appear here.</span>
          <button class="cv-btn cv-btn-ghost cv-btn-sm" @click="loadSessions">Refresh</button>
        </div>
      </aside>

      <!-- Chat Panel -->
      <section class="cv-panel">
        <template v-if="selSession">
          <!-- Chat Head -->
          <header class="cv-chat-head">
            <div class="cv-caller-info">
              <div class="cv-caller-av">{{ (displayName(selSession))[0].toUpperCase() }}</div>
              <div>
                <strong>{{ displayName(selSession) }}</strong>
                <small class="dim"> · {{ selSession.requester_actor_type }}</small>
                <span v-if="selSession.subject" class="dim small"> · {{ selSession.subject }}</span>
              </div>
            </div>
            <button class="cv-btn cv-btn-danger cv-btn-sm" @click="endChat">End chat</button>
          </header>

          <!-- Messages -->
          <div ref="chatScroller" class="cv-messages" aria-live="polite" aria-label="Chat messages">
            <div
              v-for="m in chatMessages"
              :key="m.id"
              :class="[
                'cv-msg',
                m.sender_actor_type === 'staff' ? 'cv-msg--staff' : (m.kind === 'system' || m.kind === 'bot') ? 'cv-msg--sys' : 'cv-msg--user'
              ]"
            >
              <template v-if="m.kind === 'system' || m.kind === 'bot'">
                <span class="cv-sys">{{ m.body }}</span>
              </template>
              <template v-else>
                <div class="cv-msg-bubble">
                  <span class="cv-msg-who">{{ m.sender_actor_type === 'staff' ? 'You' : (m.sender_name || displayName(selSession)) }}</span>
                  <p class="cv-msg-body">{{ m.body }}</p>
                  <span class="dim xsmall">{{ fmt(m.created_at) }}</span>
                </div>
              </template>
            </div>
            <div v-if="!chatMessages.length" class="cv-empty-thread">
              <span class="dim small">No messages yet. Start the conversation below.</span>
            </div>
          </div>

          <!-- Input -->
          <footer class="cv-input-row">
            <input
              v-model="chatDraft"
              class="cv-input"
              placeholder="Type a reply…"
              :disabled="chatSending"
              @keyup.enter="sendChat"
              aria-label="Chat message input"
            />
            <button
              class="cv-btn cv-btn-primary"
              :disabled="!chatDraft.trim() || chatSending"
              @click="sendChat"
            >
              {{ chatSending ? 'Sending…' : 'Send' }}
            </button>
          </footer>
        </template>

        <div v-else class="cv-no-session">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3">
            <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
          </svg>
          <strong>Select a session</strong>
          <span class="dim small">Choose a chat session on the left to start replying.</span>
        </div>
      </section>

    </div>
  </div>
</template>

<style scoped>
.cv-root { display: flex; flex-direction: column; gap: var(--s-4, 1rem); }

.cv-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.cv-header-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.cv-title { margin: 0; font-size: 1.1rem; }

.cv-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: var(--s-3, .75rem);
  height: 580px;
  min-height: 400px;
}

/* Session List */
.cv-list {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 12px;
  background: var(--surface, #fff);
  overflow-y: auto;
}
.cv-session {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: none;
  border-bottom: 1px solid var(--border, #e2e8f0);
  background: none;
  text-align: left;
  cursor: pointer;
  transition: background .12s;
  color: var(--text, #0f172a);
}
.cv-session:hover { background: var(--surface-2, #f8fafc); }
.cv-session--on { background: oklch(from var(--brand-500, #10b981) l c h / .07) !important; }
.cv-session-top { display: flex; align-items: center; gap: 10px; }
.cv-session-av { width: 32px; height: 32px; border-radius: 50%; background: oklch(from var(--brand-500, #10b981) l c h / .15); color: var(--brand-500, #10b981); display: grid; place-items: center; font-weight: 700; font-size: 13px; flex-shrink: 0; }
.cv-session-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.cv-session-info strong { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cv-session-info small { font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cv-unread { background: var(--warn, #f59e0b); color: #fff; border-radius: 999px; padding: 1px 6px; font-size: 10px; font-weight: 700; flex-shrink: 0; }
.cv-session-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.cv-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 20px; color: var(--mut, #64748b); text-align: center; }

/* Chat Panel */
.cv-panel {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 12px;
  background: var(--surface, #fff);
  overflow: hidden;
}
.cv-chat-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border, #e2e8f0);
  background: var(--surface-2, #f8fafc);
  flex-shrink: 0;
}
.cv-caller-info { display: flex; align-items: center; gap: 10px; }
.cv-caller-av { width: 36px; height: 36px; border-radius: 50%; background: oklch(from var(--brand-500, #10b981) l c h / .15); color: var(--brand-500, #10b981); display: grid; place-items: center; font-weight: 700; flex-shrink: 0; }

.cv-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.cv-msg { display: flex; }
.cv-msg--user { justify-content: flex-start; }
.cv-msg--staff { justify-content: flex-end; }
.cv-msg--sys { justify-content: center; }
.cv-msg-bubble { max-width: 72%; padding: 10px 13px; border-radius: 12px; display: flex; flex-direction: column; gap: 4px; }
.cv-msg--user .cv-msg-bubble { background: var(--surface-2, #f8fafc); border: 1px solid var(--border, #e2e8f0); border-bottom-left-radius: 4px; }
.cv-msg--staff .cv-msg-bubble { background: oklch(from var(--brand-500, #10b981) l c h / .1); border: 1px solid oklch(from var(--brand-500, #10b981) l c h / .2); border-bottom-right-radius: 4px; }
.cv-msg-who { font-size: 11px; font-weight: 600; color: var(--mut, #64748b); }
.cv-msg-body { margin: 0; font-size: 13px; line-height: 1.5; color: var(--text, #0f172a); }
.cv-sys { font-size: 11px; color: var(--mut, #64748b); background: var(--surface-2, #f1f5f9); padding: 3px 10px; border-radius: 999px; }
.cv-empty-thread { display: flex; align-items: center; justify-content: center; flex: 1; padding: 24px; }

.cv-input-row { display: flex; gap: 8px; padding: 12px; border-top: 1px solid var(--border, #e2e8f0); flex-shrink: 0; }
.cv-input { flex: 1; padding: 8px 12px; border: 1px solid var(--border, #e2e8f0); border-radius: 8px; background: var(--surface, #fff); font-size: 13px; color: var(--text, #0f172a); }
.cv-input:focus { outline: 2px solid var(--brand-500, #10b981); outline-offset: -1px; }

.cv-no-session { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; height: 100%; color: var(--mut, #64748b); }

/* Pills/Buttons shared */
.pill { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
.pill-ok { background: oklch(from var(--brand-500, #10b981) l c h / .12); color: var(--brand-500, #10b981); }
.pill-warn { background: oklch(from #f59e0b l c h / .12); color: #b45309; }
.pill-dim { background: var(--surface-2, #f1f5f9); color: var(--mut, #64748b); }
.dim { color: var(--mut, #64748b); }
.small { font-size: 12px; }
.xsmall { font-size: 11px; }
.cv-select { padding: 6px 10px; border: 1px solid var(--border, #e2e8f0); border-radius: 8px; background: var(--surface, #fff); font-size: 13px; color: var(--text, #0f172a); }
.cv-select-sm { padding: 4px 8px; font-size: 12px; }
.cv-btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 8px; border: none; font-size: 13px; font-weight: 500; cursor: pointer; transition: background .12s; }
.cv-btn:disabled { opacity: .5; cursor: not-allowed; }
.cv-btn-sm { padding: 4px 10px; font-size: 12px; }
.cv-btn-ghost { background: var(--surface-2, #f1f5f9); color: var(--text, #0f172a); }
.cv-btn-ghost:hover:not(:disabled) { background: var(--border, #e2e8f0); }
.cv-btn-primary { background: var(--brand-500, #10b981); color: #fff; }
.cv-btn-primary:hover:not(:disabled) { background: var(--brand-600, #059669); }
.cv-btn-danger { background: oklch(from var(--danger, #ef4444) l c h / .12); color: var(--danger, #ef4444); border: 1px solid oklch(from var(--danger, #ef4444) l c h / .3); }
.cv-btn-danger:hover { background: oklch(from var(--danger, #ef4444) l c h / .2); }

@media (max-width: 700px) {
  .cv-layout { grid-template-columns: 1fr; grid-template-rows: 220px 1fr; }
}
</style>
