<template>
  <ul v-if="items.length" class="insights" data-testid="insights">
    <li v-for="item in items" :key="item.key" :data-tone="item.tone">
      <i :class="['tone', `tone--${item.tone}`]" aria-hidden="true" />
      <div>
        <strong>{{ item.title }}</strong>
        <span>{{ item.detail }}</span>
      </div>
    </li>
  </ul>
  <p v-else class="panel-empty" data-testid="insights-empty">{{ empty }}</p>
</template>

<script setup>
/** Plain-language findings. The styles are in styles/dashboard.css. */
defineProps({
  items: { type: Array, default: () => [] },
  empty: { type: String, default: "Nothing stands out yet. Insights appear as activity builds up." }
});
</script>
