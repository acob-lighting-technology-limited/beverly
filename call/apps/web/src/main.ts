import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { useSettings } from './stores/settings'
import { vHoverScroll } from './lib/hover-scroll'
import './styles/tokens.css'
import './styles/design-tokens.css'
import './styles/app.css'

const app = createApp(App).use(createPinia()).use(router).directive('hover-scroll', vHoverScroll)
useSettings().apply()
app.mount('#root')
