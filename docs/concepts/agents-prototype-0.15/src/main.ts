import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ui from '@nuxt/ui/vue-plugin'
import App from './presentation/App.vue'
import { agentsContextKey } from './presentation/stores/applicationContext'
import { useAgentsStore } from './presentation/stores/agents'
import { seedState } from './application/bootstrap/seedState'
import { createBrowserServices } from './composition/createBrowserServices'
import './style.css'

async function bootstrap() {
  const app = createApp(App).use(createPinia()).use(ui)
  app.provide(agentsContextKey, { services: createBrowserServices(), initialState: seedState })
  const store = app.runWithContext(() => useAgentsStore())
  await store.initialize()
  app.mount('#app')
  const onBeforeUnload = (event: BeforeUnloadEvent) => {
    if (store.dirty) { event.preventDefault(); event.returnValue = '' }
  }
  window.addEventListener('beforeunload', onBeforeUnload)
  if (import.meta.hot) import.meta.hot.dispose(() => {
    window.removeEventListener('beforeunload', onBeforeUnload)
    store.$dispose()
    app.unmount()
  })
}
void bootstrap().catch(error => {
  console.error('Agents startup failed', error)
  const root = document.getElementById('app')
  if (root) root.textContent = 'Agents could not start. Saved browser data has not been replaced. Open the console for diagnostics.'
})
