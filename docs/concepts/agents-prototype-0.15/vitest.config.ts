import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// Native Node core tests have their own runner; do not load the Vite UI build plugin here.
export default defineConfig({
  plugins: [vue()],
  test: { include: ['tests/*.test.ts'], environment: 'node', clearMocks: true, restoreMocks: true }
})
