import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'
import { i18n } from './i18n'
import { router } from './router'
import './styles/auth.css'
import './styles/console.css'
import './styles/demo.css'
import './styles/landing.css'
import './styles/main.css'
import './styles/operations.css'

createApp(App).use(createPinia()).use(router).use(i18n).mount('#app')
