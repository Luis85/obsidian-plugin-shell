import { defineConfig } from 'vite';
import { readVendor, runtimeVendorCss } from './scripts/styles/vendor-policy.mjs';
function hostStyles() {
  return { name: 'fixture-host-styles',
    configureServer(server) { server.middlewares.use('/__host.css', async (_req, res) => { res.setHeader('Content-Type', 'text/css'); res.end(runtimeVendorCss(await readVendor(process.cwd()))); }); },
    async generateBundle() { this.emitFile({ type: 'asset', fileName: '__host.css', source: runtimeVendorCss(await readVendor(process.cwd())) }); },
  };
}
export default defineConfig(async ({ isPreview }) => {
  // Preview serves the qualified emitted assets, including __host.css. Running
  // build plugins here would rescan source/caches and rewrite generated inputs.
  if (isPreview) return { build: { outDir: 'dist-harness' } };
  const { sharedConfig } = await import('./scripts/bundling/vite-shared.mjs');
  const config = sharedConfig();
  return { ...config, plugins: [...config.plugins, hostStyles()],
    build: { ...config.build, outDir: 'dist-harness', emptyOutDir: true, rolldownOptions: { input: 'harness/app/index.html' } },
    server: { host: '127.0.0.1', port: 4173, strictPort: true },
  };
});
