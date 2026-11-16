<script setup lang="ts">
/** Full-screen lock shown after the idle timeout. Emits instead of owning session logic.
 *  Used by: App.vue. */
import Icon from '@/components/Icon.vue'

defineEmits<{ (e: 'continue'): void; (e: 'signOut'): void }>()
</script>

<template>
  <div id="lockov" class="on" role="alertdialog" aria-modal="true" aria-label="Session timed out">
    <div class="lkc"><Icon name="lock" /><h2>Session timed out</h2><p>You were away for a while. Continue to pick up where you left off.</p>
      <div class="btns"><button class="y" autofocus @click="$emit('continue')">Continue</button><button @click="$emit('signOut')">Sign out</button></div></div>
  </div>
</template>
