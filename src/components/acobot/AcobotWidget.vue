<template>
  <div class="beverly-ai-widget-wrapper">
    <!-- Discovery Nudge: sits next to trigger button, auto-appears after 5s if not seen -->
    <transition name="beverly-nudge">
      <div v-if="!isOpen && showNudge" class="beverly-ai-nudge-bubble" role="status">
        <button
          type="button"
          class="beverly-ai-nudge-btn"
          @click="openFromNudge"
        >
          👋 Hi <strong>{{ userFirstName }}</strong> — need to find something? Ask <strong>Beverly AI</strong>.
        </button>
        <button
          type="button"
          class="beverly-ai-nudge-dismiss"
          @click="dismissNudge"
          aria-label="Dismiss Beverly AI tip"
        >
          <svg class="beverly-svg-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </transition>

    <!-- Responsive Floating Trigger Button with Bot Head & Orbital Antenna -->
    <BaseButton
      class="beverly-ai-trigger-btn"
      variant="ghost"
      :class="{ active: isOpen }"
      @click="toggleWidget"
      title="Beverly AI Operations Assistant"
      aria-label="Toggle Beverly AI Assistant"
    >
      <div class="beverly-ai-glow-pulse"></div>
      <span class="beverly-ai-trigger-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="3" r="1.5"></circle>
          <path d="M12 4.5v2.5"></path>
          <rect x="4" y="7" width="16" height="13" rx="4" ry="4"></rect>
          <circle cx="9" cy="12" r="1.5"></circle>
          <circle cx="15" cy="12" r="1.5"></circle>
          <path d="M9.5 16.5h5"></path>
          <path d="M1.5 13.5h2.5"></path>
          <path d="M20 13.5h2.5"></path>
        </svg>
      </span>
      <span class="beverly-ai-trigger-label">Beverly AI</span>
    </BaseButton>

    <!-- Floating Liquid Glass Modal -->
    <div v-if="isOpen" class="beverly-ai-modal" :class="{ minimized: isMinimized }" role="dialog" aria-label="Beverly AI Command Console">
      <div class="beverly-liquid-specular"></div>

      <!-- Header -->
      <header class="beverly-ai-header">
        <div class="beverly-ai-brand">
          <div class="beverly-ai-avatar-wrap">
            <div class="beverly-ai-avatar" role="img" aria-label="Beverly Brand Emblem"></div>
            <span class="beverly-ai-status-dot"></span>
          </div>
          <div>
            <h3 class="beverly-ai-title">Beverly AI</h3>
            <span class="beverly-ai-subtitle">CRM Operations Engine</span>
          </div>
        </div>

        <div class="beverly-ai-header-actions">
          <button type="button" class="beverly-ai-icon-btn" @click="isMinimized = !isMinimized" :title="isMinimized ? 'Expand' : 'Minimize'">
            <svg class="beverly-svg-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
          <button type="button" class="beverly-ai-icon-btn" @click="closeWidget" title="Close widget">
            <svg class="beverly-svg-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </header>

      <template v-if="!isMinimized">
        <div ref="messageContainer" class="beverly-ai-messages" @click="handleContainerClick">
          <div v-if="messages.length === 0" class="beverly-ai-welcome">
            <!-- Pop-up Greeting Card -->
            <div class="beverly-ai-popup-greeting">
              <div class="beverly-ai-popup-avatar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <rect x="5" y="8" width="14" height="12" rx="3"></rect>
                  <path d="M12 2v6"></path>
                  <circle cx="9" cy="13" r="1"></circle>
                  <circle cx="15" cy="13" r="1"></circle>
                </svg>
              </div>
              <div class="beverly-ai-popup-body">
                <p>👋 Hi <strong>{{ userFirstName }}</strong>, I'm <strong>Beverly AI</strong>. I can help you inspect OEM meter gateways, audit STS vending strategy, review customer KYC compliance, and resolve disputes.</p>
              </div>
            </div>

            <!-- Context-Aware Dynamic "Try asking" 2x2 Grid -->
            <div class="beverly-ai-try-asking-section">
              <span class="beverly-ai-try-asking-title">Try asking</span>
              <div class="beverly-ai-chip-grid-2x2">
                <button
                  v-for="chip in activeChips"
                  :key="chip.label"
                  type="button"
                  class="beverly-ai-chip-card"
                  @click="sendPrompt(chip.label)"
                >
                  <div class="beverly-chip-icon-box">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                      <path :d="chip.iconPath"></path>
                    </svg>
                  </div>
                  <span>{{ chip.label }}</span>
                </button>
              </div>
            </div>
          </div>

          <div
            v-for="(msg, index) in messages"
            :key="index"
            :class="['beverly-ai-msg-row', msg.sender === 'user' ? 'user-row' : 'bot-row']"
          >
            <div class="beverly-ai-msg-bubble">
              <div class="beverly-ai-msg-sender">
                <div class="beverly-ai-sender-tag">
                  <svg v-if="msg.sender === 'user'" class="beverly-svg-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                  <svg v-else class="beverly-svg-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                    <rect x="5" y="8" width="14" height="12" rx="3"></rect>
                    <path d="M12 2v6"></path>
                    <circle cx="9" cy="13" r="1"></circle>
                    <circle cx="15" cy="13" r="1"></circle>
                  </svg>
                  <span>{{ msg.sender === 'user' ? 'You' : 'Beverly AI' }}</span>
                </div>

                <button v-if="msg.sender === 'bot'" type="button" class="beverly-copy-btn" @click="copyText(msg.text)" title="Copy text">
                  <svg class="beverly-svg-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                  </svg>
                </button>
              </div>
              <div class="beverly-ai-msg-content" v-html="formatMessage(msg.text)"></div>

              <!-- Outline Access Policy Badge -->
              <div v-if="msg.permissionStatus === 'denied'" class="beverly-ai-denied-badge">
                <svg class="beverly-svg-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                <span>Restricted by Access Policy</span>
              </div>

              <!-- Interactive Retry Request Button -->
              <div v-if="msg.isError && msg.lastPrompt" class="beverly-ai-retry-wrapper">
                <button
                  type="button"
                  class="beverly-ai-retry-btn"
                  @click="retryPrompt(msg.lastPrompt, index)"
                  title="Retry sending this request"
                >
                  <svg class="beverly-svg-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                  </svg>
                  <span>Retry Request</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Thinking State -->
          <div v-if="isThinking" class="beverly-ai-thinking">
            <svg class="beverly-svg-sparkle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
              <path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4L12 2z"></path>
            </svg>
            <span>Analyzing requests…</span>
          </div>
        </div>

        <!-- Input Bar -->
        <footer class="beverly-ai-footer">
          <div class="beverly-ai-input-wrap">
            <button
              type="button"
              class="beverly-ai-voice-btn"
              :class="{ listening: isListening }"
              @click="toggleListening"
              title="Voice Search"
            >
              <svg class="beverly-svg-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="22"></line>
              </svg>
            </button>

            <input
              ref="chatInput"
              v-model="inputPrompt"
              type="text"
              class="beverly-ai-input"
              placeholder="Ask Beverly AI or speak..."
              @keyup.enter="handleSend"
            />

            <button
              type="button"
              class="beverly-ai-send-btn"
              :disabled="!inputPrompt.trim() || isThinking"
              @click="handleSend"
              title="Send Prompt"
            >
              <svg class="beverly-svg-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        </footer>
      </template>
    </div>
  </div>
</template>

<script>
import { apiClient } from "../../services/api";
import { currentUserInfo } from "../../services/api";
import BaseButton from "../base/BaseButton.vue";
import { formatAiMessage } from "@beverly/tokens/ai-message";

const NUDGE_STORAGE_KEY = "beverly-ai:nudge-seen";

export default {
  name: "AcobotWidget",
  components: { BaseButton },
  data() {
    return {
      isOpen: false,
      isMinimized: false,
      showNudge: false,
      nudgeTimer: null,
      inputPrompt: "",
      isThinking: false,
      isListening: false,
      speakResponses: false,
      messages: [],
      quickChips: [
        {
          label: "Diagnose OEM Meters",
          iconPath: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 7v5l3 2",
        },
        {
          label: "STS Tariffs & Vending",
          iconPath: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
        },
        {
          label: "Pending KYC Reviews",
          iconPath: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
        },
        {
          label: "Dispute Tickets",
          iconPath: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
        },
      ],
    };
  },
  computed: {
    userFirstName() {
      const user = currentUserInfo();
      const name = user?.name || user?.full_name || "";
      if (!name.trim()) return "Operator";
      return name.trim().split(" ")[0];
    },
    activeChips() {
      const hash = (window.location.hash || window.location.pathname || "").toLowerCase();
      if (hash.includes("battery") || hash.includes("fleet") || hash.includes("station") || hash.includes("rack") || hash.includes("crm")) {
        return [
          { label: "15S Cell Diagnostics", iconPath: "M13 2L3 14h9l-1 8 10-12h-9l1-8z" },
          { label: "Station Locker Status", iconPath: "M4 6h16M4 12h16M4 18h16" },
          { label: "Live GPS Tracker Map", iconPath: "M12 2a8 8 0 0 0-8 8c0 5 8 12 8 12s8-7 8-12a8 8 0 0 0-8-8z" },
          { label: "Rider Lease CRM", iconPath: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" },
        ];
      }
      if (hash.includes("wallet") || hash.includes("funding") || hash.includes("settlement") || hash.includes("vending")) {
        return [
          { label: "Current Funding Queue", iconPath: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V6m0 12v-2" },
          { label: "Daily Settlement Summary", iconPath: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
          { label: "STS Tariffs & VAT 7.5%", iconPath: "M13 2L3 14h9l-1 8 10-12h-9l1-8z" },
          { label: "Reconciliation Audit", iconPath: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
        ];
      }
      if (hash.includes("meter") || hash.includes("daily-data") || hash.includes("consumption")) {
        return [
          { label: "Interval AMR Readings", iconPath: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 7v5l3 2" },
          { label: "Station Consumption Trends", iconPath: "M13 2L3 14h9l-1 8 10-12h-9l1-8z" },
          { label: "Abnormal Tamper Alarms", iconPath: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
          { label: "SparkMeter Koios Sandbox", iconPath: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
        ];
      }
      return this.quickChips;
    },
  },
  mounted() {
    window.addEventListener("beverly-ai-open-prompt", this.onGlobalPromptEvent);
    window.addEventListener("keydown", this.onKeydown);

    // One-time discovery nudge (ACOB ERP feature): appears after 5s if never seen
    try {
      const seen = window.localStorage.getItem(NUDGE_STORAGE_KEY) === "1";
      if (!seen) {
        this.nudgeTimer = setTimeout(() => {
          if (!this.isOpen) {
            this.showNudge = true;
          }
        }, 5000);
      }
    } catch (e) {
      // Storage unavailable in private modes
    }
  },
  beforeUnmount() {
    window.removeEventListener("beverly-ai-open-prompt", this.onGlobalPromptEvent);
    window.removeEventListener("keydown", this.onKeydown);
    if (this.nudgeTimer) clearTimeout(this.nudgeTimer);
  },
  methods: {
    onKeydown(e) {
      if (e.key === "Escape" && this.isOpen) {
        this.closeWidget();
      }
    },
    dismissNudge() {
      this.showNudge = false;
      try {
        window.localStorage.setItem(NUDGE_STORAGE_KEY, "1");
      } catch (e) {}
    },
    openFromNudge() {
      this.dismissNudge();
      this.isOpen = true;
      this.scrollToBottom();
      this.focusInput();
    },
    onGlobalPromptEvent(e) {
      const promptText = e.detail?.prompt;
      if (promptText) {
        this.isOpen = true;
        this.isMinimized = false;
        this.sendPrompt(promptText);
      }
    },
    toggleWidget() {
      this.dismissNudge();
      this.isOpen = !this.isOpen;
      if (this.isOpen) {
        this.scrollToBottom();
        this.focusInput();
      }
    },
    closeWidget() {
      this.isOpen = false;
    },
    focusInput() {
      this.$nextTick(() => {
        if (this.$refs.chatInput) {
          this.$refs.chatInput.focus();
        }
      });
    },
    scrollToBottom() {
      this.$nextTick(() => {
        if (this.$refs.messageContainer) {
          this.$refs.messageContainer.scrollTop = this.$refs.messageContainer.scrollHeight;
        }
      });
    },
    formatMessage(text) {
      return formatAiMessage(text);
    },
    handleContainerClick(e) {
      const link = e.target.closest(".beverly-ai-route-link");
      if (!link) return;
      const route = link.getAttribute("data-route") || link.getAttribute("href");
      if (!route) return;

      if (route.startsWith("#") || route.startsWith("/")) {
        e.preventDefault();
        if (this.$router) {
          const target = route.startsWith("#") ? route.slice(1) : route;
          this.$router.push(target).catch(() => {});
        } else {
          window.location.hash = route.startsWith("#") ? route : `#${route}`;
        }
        this.closeWidget();
      }
    },
    copyText(text) {
      navigator.clipboard.writeText(text);
    },
    speakText(text) {
      if (!this.speakResponses || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.replace(/<[^>]*>?/gm, ""));
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    },
    toggleListening() {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert("Speech recognition is not supported in this browser.");
        return;
      }
      if (this.isListening) {
        this.isListening = false;
        return;
      }
      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.interimResults = false;
      recognition.onstart = () => { this.isListening = true; };
      recognition.onresult = (event) => {
        this.inputPrompt = event.results[0][0].transcript;
        this.isListening = false;
        this.handleSend();
      };
      recognition.onerror = () => { this.isListening = false; };
      recognition.onend = () => { this.isListening = false; };
      recognition.start();
    },
    async handleSend() {
      const prompt = this.inputPrompt.trim();
      if (!prompt || this.isThinking) return;
      this.inputPrompt = "";
      await this.sendPrompt(prompt);
    },
    async retryPrompt(prompt, index) {
      if (index >= 0 && index < this.messages.length) {
        this.messages.splice(index, 1);
      }
      await this.sendPrompt(prompt, true);
    },
    async sendPrompt(prompt, isRetry = false) {
      if (!isRetry) {
        this.messages.push({ sender: "user", text: prompt });
      }
      this.scrollToBottom();
      this.isThinking = true;

      try {
        const currentPath = window.location.hash || window.location.pathname;
        const res = await apiClient.post("/v1/acobot/chat", {
          prompt,
          portal: "crm",
          currentPath,
        });
        const data = res.data || {};
        this.messages.push({
          sender: "bot",
          text: data.response || "Request completed.",
          permissionStatus: data.permissionStatus,
        });
        this.speakText(data.response || "");
      } catch (err) {
        const errorMsg = err?.response?.status === 401
          ? "Authentication required. Please log in to chat with Beverly AI."
          : (err?.message?.includes("timeout") || err?.message?.includes("long"))
            ? "The server took too long to respond. Please try again."
            : err?.response?.data?.message || err?.message || "Sorry, I encountered an error connecting to Beverly AI backend.";

        this.messages.push({
          sender: "bot",
          text: errorMsg,
          isError: true,
          lastPrompt: prompt,
        });
      } finally {
        this.isThinking = false;
        this.scrollToBottom();
      }
    },
  },
};
</script>

<style scoped>
.beverly-ai-widget-wrapper {
  position: fixed;
  bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  right: 16px;
  z-index: 9999;
  font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
}

/* Discovery Nudge Bubble (from ACOB ERP) */
.beverly-ai-nudge-bubble {
  position: absolute;
  right: calc(100% + 12px);
  bottom: 4px;
  background: var(--surface-2, #1e293b);
  color: var(--text, #f8fafc);
  border: 1px solid var(--brand-glow, rgba(16, 185, 129, 0.4));
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px 8px 12px;
  max-width: 280px;
  white-space: normal;
  z-index: 9998;
}

.beverly-ai-nudge-btn {
  background: transparent;
  border: none;
  color: inherit;
  font-size: 13px;
  line-height: 1.35;
  text-align: left;
  cursor: pointer;
  padding: 0;
}

.beverly-ai-nudge-btn strong {
  color: var(--primary, #10b981);
}

.beverly-ai-nudge-dismiss {
  background: transparent;
  border: none;
  color: var(--text-dim, #94a3b8);
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.beverly-ai-nudge-dismiss:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text, #f8fafc);
}

.beverly-nudge-enter-active,
.beverly-nudge-leave-active {
  transition: all 0.25s ease-out;
}

.beverly-nudge-enter-from,
.beverly-nudge-leave-to {
  opacity: 0;
  transform: translateX(10px) scale(0.95);
}

.beverly-ai-trigger-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 18px;
  border-radius: 9999px;
  background: var(--surface, #1e293b);
  border: 1px solid var(--brand-glow, rgba(16, 185, 129, 0.4));
  color: var(--text, #f8fafc);
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  transition: all 0.2s ease;
  position: relative;
}

.beverly-ai-trigger-btn:hover {
  transform: translateY(-2px);
  border-color: var(--brand-400, #34d399);
  box-shadow: 0 12px 32px var(--brand-glow, rgba(16, 185, 129, 0.4));
}

.beverly-ai-trigger-icon svg {
  width: 20px;
  height: 20px;
  color: var(--brand-400, #34d399);
}

.beverly-ai-modal {
  position: fixed;
  bottom: calc(70px + env(safe-area-inset-bottom, 0px));
  right: 12px;
  width: min(380px, calc(100vw - 24px));
  height: min(530px, calc(100dvh - 100px));
  border-radius: 16px;
  background: var(--surface, #0f172a);
  border: 1px solid var(--border-color, #334155);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 10000;
  animation: modalSlideUp 0.25s ease-out;
}

@keyframes modalSlideUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

.beverly-ai-header {
  padding: 10px 14px;
  background: var(--surface-2, #1e293b);
  border-bottom: 1px solid var(--border-color, #334155);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.beverly-ai-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.beverly-ai-avatar-wrap {
  position: relative;
  width: 32px;
  height: 32px;
}

.beverly-ai-avatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: var(--brand-mark-url, url('/brand/beverly-mark.png')) center / contain no-repeat var(--surface-2, #1e293b);
  border: 1px solid var(--primary, #16a34a);
}

.beverly-ai-status-dot {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--primary, #16a34a);
  border: 2px solid #0f172a;
}

.beverly-ai-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--text, #f8fafc);
}

.beverly-ai-subtitle {
  font-size: 11px;
  color: var(--text-dim, #94a3b8);
}

.beverly-ai-header-actions {
  display: flex;
  gap: 6px;
}

.beverly-ai-icon-btn {
  background: transparent;
  border: none;
  color: var(--text-dim, #94a3b8);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
}

.beverly-ai-icon-btn:hover {
  color: var(--text, #f8fafc);
  background: rgba(255, 255, 255, 0.1);
}

.beverly-svg-icon-sm {
  width: 16px;
  height: 16px;
}

.beverly-svg-icon-xs {
  width: 12px;
  height: 12px;
}

.beverly-ai-messages {
  flex: 1;
  padding: 12px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.beverly-ai-popup-greeting {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  margin-bottom: 10px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--surface-2, #1e293b) 90%, var(--primary, #16a34a));
  border: 1px solid color-mix(in srgb, var(--primary, #16a34a) 32%, transparent);
}

.beverly-ai-popup-avatar {
  width: 24px;
  height: 24px;
  color: var(--primary, #16a34a);
  flex-shrink: 0;
  margin-top: 2px;
}

.beverly-ai-popup-body p {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--text, #f8fafc);
}

.beverly-ai-try-asking-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.beverly-ai-try-asking-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-dim, #94a3b8);
  letter-spacing: 0.05em;
}

.beverly-ai-chip-grid-2x2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.beverly-ai-chip-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px;
  border-radius: 10px;
  background: var(--surface-2, #1e293b);
  border: 1px solid var(--border-color, #334155);
  color: var(--text, #f8fafc);
  font-size: 12px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.beverly-ai-chip-card:hover {
  background: var(--surface-3, #334155);
  border-color: var(--primary, #16a34a);
  color: var(--primary, #16a34a);
}

.beverly-chip-icon-box {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.beverly-chip-icon-box svg {
  width: 16px;
  height: 16px;
}

.beverly-ai-msg-row {
  display: flex;
  width: 100%;
}

.beverly-ai-msg-row.user-row {
  justify-content: flex-end;
}

.beverly-ai-msg-row.bot-row {
  justify-content: flex-start;
}

.beverly-ai-msg-bubble {
  max-width: 85%;
  border-radius: 14px;
  padding: 10px 12px;
  font-size: 13px;
  line-height: 1.45;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.user-row .beverly-ai-msg-bubble {
  background: var(--primary, #10b981);
  color: #ffffff;
  border-bottom-right-radius: 4px;
}

.bot-row .beverly-ai-msg-bubble {
  background: var(--surface-2, #1e293b);
  border: 1px solid var(--border-color, #334155);
  color: var(--text, #f8fafc);
  border-bottom-left-radius: 4px;
}

.beverly-ai-msg-sender {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 4px;
  opacity: 0.85;
}

.beverly-ai-sender-tag {
  display: flex;
  align-items: center;
  gap: 4px;
}

.beverly-copy-btn {
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
}

.beverly-copy-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

.beverly-ai-denied-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid #ef4444;
  color: #fca5a5;
  font-size: 11px;
  font-weight: 600;
}

.beverly-ai-retry-wrapper {
  margin-top: 8px;
}

.beverly-ai-retry-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(239, 68, 68, 0.2);
  border: 1px solid #ef4444;
  color: #fca5a5;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.beverly-ai-retry-btn:hover {
  background: rgba(239, 68, 68, 0.35);
}

.beverly-ai-thinking {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-dim, #94a3b8);
  font-size: 12px;
  padding: 4px 8px;
}

.beverly-svg-sparkle {
  width: 16px;
  height: 16px;
  color: #10b981;
  animation: spin 2s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.beverly-ai-footer {
  padding: 9px 12px;
  background: var(--surface-2, #1e293b);
  border-top: 1px solid var(--border-color, #334155);
}

.beverly-ai-input-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--surface, #0f172a);
  border: 1px solid var(--border-color, #334155);
  border-radius: 10px;
  padding: 4px 8px;
  transition: border-color 0.15s ease;
}

.beverly-ai-input-wrap:focus-within {
  border-color: var(--primary, #16a34a);
}

.beverly-ai-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text, #f8fafc);
  font-size: 13px;
  padding: 6px 4px;
}

.beverly-ai-voice-btn, .beverly-ai-send-btn {
  background: transparent;
  border: none;
  color: var(--text-dim, #94a3b8);
  cursor: pointer;
  padding: 4px;
}

.beverly-ai-send-btn {
  color: #10b981;
}

.beverly-ai-send-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* Route Links & Rich Markdown Formatting (from ACOB ERP) */
:deep(.beverly-ai-route-link) {
  color: var(--primary, #10b981);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
  transition: opacity 0.15s;
}

:deep(.beverly-ai-route-link:hover) {
  opacity: 0.8;
}

:deep(.beverly-ai-inline-code) {
  background: var(--surface-3, #334155);
  color: var(--text, #f8fafc);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  font-family: monospace;
}

:deep(.beverly-ai-code-block) {
  background: #090d16;
  border: 1px solid var(--border-color, #334155);
  border-radius: 8px;
  padding: 10px 12px;
  overflow-x: auto;
  font-size: 12px;
  font-family: monospace;
  margin: 6px 0;
}

:deep(.beverly-ai-action-card-box) {
  background: color-mix(in srgb, var(--surface-2, #1e293b) 80%, var(--primary, #10b981) 20%);
  border: 1px solid var(--primary, #10b981);
  border-radius: 10px;
  padding: 10px 12px;
  margin: 8px 0;
}

:deep(.beverly-ai-action-badge) {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--primary, #10b981);
  margin-bottom: 4px;
}

@media (max-width: 600px) {
  .beverly-ai-widget-wrapper { right: 12px; }
  .beverly-ai-nudge-bubble {
    right: 0;
    bottom: 58px;
    max-width: calc(100vw - 32px);
  }
  .beverly-ai-modal {
    width: calc(100vw - 16px);
    height: min(510px, calc(100dvh - 96px));
    right: 8px;
    bottom: calc(68px + env(safe-area-inset-bottom, 0px));
    border-radius: 14px;
  }
  .beverly-ai-chip-card { min-width: 0; }
}

@media (max-width: 360px) {
  .beverly-ai-chip-grid-2x2 { grid-template-columns: 1fr; }
}

@media (prefers-reduced-motion: reduce) {
  .beverly-ai-modal,
  .beverly-ai-trigger-btn,
  .beverly-ai-chip-card,
  .beverly-ai-nudge-bubble { animation: none; transition: none; }
}
</style>
