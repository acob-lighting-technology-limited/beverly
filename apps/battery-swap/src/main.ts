import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';

import '@beverly/tokens/tokens.css';
import '@beverly/tokens/theme.css';
import '@beverly/tokens/wallet.css';
import './styles/acob-battery-swap-tokens.css';
import './styles/registry.css';
import './styles/live.css';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
