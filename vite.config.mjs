import { defineConfig } from 'vite';
import { licenseNotices } from './scripts/build/license-notices.mjs';
import { sharedConfig } from './scripts/build/vite-shared.mjs';
export default defineConfig(() => {
  const config = sharedConfig();
  return { ...config, plugins: [...config.plugins, licenseNotices()], build: { ...config.build, outDir: 'dist', emptyOutDir: true,
    lib: { entry: 'src/main.ts', formats: ['cjs'], fileName: () => 'main.js', cssFileName: 'styles' },
    rolldownOptions: { external: ['obsidian'], output: { exports: 'default', codeSplitting: false } },
  } };
});
