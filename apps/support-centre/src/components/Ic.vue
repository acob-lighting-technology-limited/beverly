<script setup lang="ts">
const props = withDefaults(defineProps<{ n: string; s?: number }>(), { s: 20 });

const IC: Record<string, string> = {
  mic: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3",
  micoff: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3M4 4l16 16",
  pause: "M8 5v14M16 5v14",
  play: "M7 4l13 8-13 8z",
  grid: "M5 5h.01M12 5h.01M19 5h.01M5 12h.01M12 12h.01M19 12h.01M5 19h.01M12 19h.01M19 19h.01",
  swap: "M7 7h13l-4-4M17 17H4l4 4",
  end: "M3 15c5-4 13-4 18 0l-2 3-3-2v-3c-3-1-7-1-10 0v3l-3 2z",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7z",
  ticket: "M4 8a2 2 0 0 0 0 8v2h16v-2a2 2 0 0 1 0-8V6H4zM12 6v12",
  user: "M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  search: "M21 21l-4.3-4.3M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  moon: "M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  bell: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0",
  help: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01",
};
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    :width="s"
    :height="s"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="IC[n] || 'M12 12h.01'" />
  </svg>
</template>
