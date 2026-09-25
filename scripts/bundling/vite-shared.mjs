import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import vue from '@vitejs/plugin-vue';
import ui from '@nuxt/ui/vite';
import { cssOwnership } from './css-ownership.mjs';
const root = process.cwd();
const profile = JSON.parse(readFileSync(resolve(root, 'scripts/bundling/ui-adaptation.json'), 'utf8'));
const replacements = new Map(Object.keys(profile.replaced).map((p, index) => [resolve(root, p).replaceAll('\\', '/'), index]));
function staticVendor() {
  return { name: 'plugin-shell-static-ui', enforce: 'pre',
    buildStart() {
      for (const [path, expected] of Object.entries(profile.replaced)) {
        const actual = createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex');
        if (actual !== expected) throw new Error(`Unqualified Nuxt UI module: ${path}`);
      }
    },
    resolveId(id) {
      const replacement = replacements.get(id.replaceAll('\\', '/'));
      if (replacement !== undefined) return `${resolve(root, 'src/infrastructure/ui/static-plugin.ts')}?qualified-ui=${replacement}`;
    },
  };
}
export function sharedConfig() {
  const identity = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'));
  return {
    plugins: [staticVendor(), vue(), ui({ root, router: false, colorMode: false, autoImport: false, components: false,
      experimental: { componentDetection: true },
      theme: { prefix: 'ps', colors: ['primary', 'secondary', 'success', 'info', 'warning', 'error'] },
      icon: { mode: 'svg', clientBundle: { icons: ['lucide:layout-dashboard', 'lucide:file-plus-2', 'lucide:radio', 'lucide:sliders-horizontal', 'lucide:panel-top', 'lucide:scan-text', 'lucide:file-check-2', 'lucide:arrow-up-right', 'lucide:bell', 'lucide:message-square-warning', 'lucide:x', 'lucide:check', 'lucide:loader-circle', 'lucide:ellipsis-vertical'] } },
    })],
    css: { postcss: { plugins: [cssOwnership(identity.id)] } },
    define: { 'process.env.NODE_ENV': JSON.stringify('production'), 'import.meta.dev': false, __VUE_OPTIONS_API__: true, __VUE_PROD_DEVTOOLS__: false },
    build: { target: 'es2022', sourcemap: false, cssCodeSplit: false, minify: true },
  };
}
