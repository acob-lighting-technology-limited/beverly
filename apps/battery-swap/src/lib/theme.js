/**
 * Shared appearance state for Beverly PUE: a mode (light or dark) and a palette (which accent family).
 * One reactive value each, used by the shell, the hub, the sign-in pages and the account menu.
 * Light and the Beverly yellow palette are the defaults. The choice is kept in this browser only
 * (a per-viewer convenience, never data).
 */
import { ref } from "vue";

const MODE_KEY = "beverly.batterySwap.theme";
const PALETTE_KEY = "beverly.batterySwap.palette";

export const PALETTES = [
  { id: "yellow", label: "Beverly yellow", note: "Cream and yellow, as in Beverly Call", swatch: ["#ffe88a", "#fcd95c", "#e6b933"] },
  { id: "mono", label: "Black and white", note: "Neutral, with black and white accents", swatch: ["#4a4a4f", "#1f1f22", "#000000"] },
  { id: "green", label: "White and green", note: "White with the Beverly wallet green", swatch: ["#35b553", "#138a2f", "#0d6e22"] }
];

export const theme = ref("light");
export const palette = ref("yellow");

function apply() {
  const root = document.documentElement;
  root.dataset.theme = theme.value;
  root.dataset.palette = palette.value;
}

/** Reads the saved choices once, at start-up. Missing or blocked storage leaves the defaults. */
export function loadTheme() {
  try {
    const mode = localStorage.getItem(MODE_KEY);
    if (mode === "light" || mode === "dark") theme.value = mode;
    const pal = localStorage.getItem(PALETTE_KEY);
    if (PALETTES.some((p) => p.id === pal)) palette.value = pal;
  } catch {}
  apply();
}

export function setTheme(mode) {
  if (mode !== "light" && mode !== "dark") return;
  theme.value = mode;
  apply();
  try { localStorage.setItem(MODE_KEY, mode); } catch {}
}

export function setPalette(id) {
  if (!PALETTES.some((p) => p.id === id)) return;
  palette.value = id;
  apply();
  try { localStorage.setItem(PALETTE_KEY, id); } catch {}
}

export function toggleTheme() {
  setTheme(theme.value === "dark" ? "light" : "dark");
}
