import { createApp } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import ui from '@nuxt/ui/vue-plugin'
import App from './App.vue'
import { addCollection } from '@iconify/vue'
import lucideIcons from '@iconify-json/lucide/icons.json'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/minimap/dist/style.css'
import './style.css'

// Embed Nuxt UI's default icon collection rather than relying on runtime icon downloads.
addCollection(lucideIcons)

// A memory router satisfies Nuxt UI's link integration without creating routes,
// shell navigation, a simulated SaaS application, or file:// path dependencies.
const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }]
})
router.push('/')
createApp(App).use(router).use(ui).mount('#app')
