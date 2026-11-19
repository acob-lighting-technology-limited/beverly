<script setup lang="ts">
/**
 * FundingProofModal — shows the receipt a payer uploaded when they funded by bank transfer.
 * The signed URL comes from the funding row (proof_view_url); nothing is fetched here.
 */
import { computed, onBeforeUnmount, watch } from 'vue';

const props = defineProps<{
    open: boolean;
    url: string | null;
    path?: string | null;
    reference?: string | null;
}>();
const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>();

const isPdf = computed(() => /\.pdf(\?|$)/i.test(props.path ?? '') || /\.pdf(\?|$)/i.test(props.url ?? ''));

function close() { emit('update:open', false); }
function onKey(e: KeyboardEvent) { if (e.key === 'Escape') close(); }

watch(() => props.open, (open) => {
    if (open) window.addEventListener('keydown', onKey);
    else window.removeEventListener('keydown', onKey);
}, { immediate: true });
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fp-backdrop" data-testid="funding-proof-modal" @click.self="close">
      <div class="fp-dialog" role="dialog" aria-modal="true" aria-label="Uploaded funding receipt">
        <header class="fp-head">
          <div>
            <h2 class="fp-title">Uploaded funding receipt</h2>
            <p v-if="reference" class="fp-ref bw-mono">{{ reference }}</p>
          </div>
          <button type="button" class="bw-btn sm" data-testid="funding-proof-close" @click="close">Close</button>
        </header>
        <div class="fp-body">
          <p v-if="!url" class="bw-muted">This receipt is not available to view. It may have expired or been removed.</p>
          <iframe v-else-if="isPdf" :src="url" class="fp-frame" title="Uploaded funding receipt" />
          <img v-else :src="url" class="fp-img" alt="Receipt uploaded for this funding" />
        </div>
        <footer v-if="url" class="fp-foot">
          <a :href="url" target="_blank" rel="noopener" class="bw-btn sm">Open in new tab</a>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.fp-backdrop { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 16px; background: rgba(0, 0, 0, .55); }
.fp-dialog { width: min(720px, 100%); max-height: 92vh; display: flex; flex-direction: column; background: var(--bw-surface, #fff); color: inherit; border-radius: 12px; overflow: hidden; }
.fp-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding: 16px 20px; border-bottom: 1px solid rgba(128, 128, 128, .25); }
.fp-title { margin: 0; font-size: 16px; }
.fp-ref { margin: 4px 0 0; font-size: 12px; }
.fp-body { padding: 16px 20px; overflow: auto; display: grid; place-items: center; min-height: 200px; }
.fp-img { max-width: 100%; max-height: 70vh; object-fit: contain; }
.fp-frame { width: 100%; height: 70vh; border: 0; }
.fp-foot { padding: 12px 20px; border-top: 1px solid rgba(128, 128, 128, .25); display: flex; justify-content: flex-end; }
</style>
