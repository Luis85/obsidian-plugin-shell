import { defineConfig } from 'vite';
import { licenseNotices } from './scripts/bundling/license-notices.mjs';
import { sharedConfig } from './scripts/bundling/vite-shared.mjs';
import { moduleAttribution } from './scripts/bundling/module-attribution.mjs';
export default defineConfig(() => {
  const config = sharedConfig();
  return { ...config, plugins: [...config.plugins, licenseNotices(), moduleAttribution()], build: { ...config.build, outDir: 'dist', emptyOutDir: true,
    lib: { entry: 'src/main.ts', formats: ['cjs'], fileName: () => 'main.js', cssFileName: 'styles' },
    rolldownOptions: { external: ['obsidian'], output: { exports: 'default', codeSplitting: false } },
  } };
});
