import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { mobileAccordionTable } from './directives/mobileAccordionTable'
import './assets/main.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.directive('mobile-accordion', mobileAccordionTable)

router.isReady().then(() => app.mount('#app'))
