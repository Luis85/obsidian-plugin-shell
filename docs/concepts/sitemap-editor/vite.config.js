import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import ui from '@nuxt/ui/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Nuxt UI's official Vue/Vite integration; no Nuxt server or application shell.
export default defineConfig({
  base: './',
  plugins: [
    vue(),
    ui({ ui: { colors: { primary: 'teal', neutral: 'slate' } } }),
    viteSingleFile()
  ],
  build: {
    target: 'es2022',
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 1500
  }
})
