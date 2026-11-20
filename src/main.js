import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { initLocale } from "@beverly/tokens/i18n.js";
import { installGlobalErrorHandlers, recordClientError } from "./services/error-logger.mjs";
import "./styles/reference.css";

// Apply the saved palette before the first paint so the shell never flashes the wrong colours.
try {
  const savedPalette = localStorage.getItem("beverly.crm.palette");
  document.documentElement.setAttribute("data-palette", ["yellow", "mono", "green"].includes(savedPalette) ? savedPalette : "green");
} catch { document.documentElement.setAttribute("data-palette", "green"); }

installGlobalErrorHandlers();
initLocale();

const app = createApp(App);
app.config.errorHandler = (error, _instance, info) => {
  recordClientError("vue-error", error, { info: String(info || "") });
};
app.use(createPinia()).mount("#app");
