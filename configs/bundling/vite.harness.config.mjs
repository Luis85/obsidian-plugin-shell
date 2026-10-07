import { defineConfig } from 'vite';
import { readVendor, runtimeVendorCss } from '../../tooling/styles/vendor-policy.mjs';
function hostStyles() {
  return { name: 'fixture-host-styles',
    configureServer(server) { server.middlewares.use('/__host.css', async (_req, res) => { res.setHeader('Content-Type', 'text/css'); res.end(runtimeVendorCss(await readVendor(process.cwd()))); }); },
    async generateBundle() { this.emitFile({ type: 'asset', fileName: '__host.css', source: runtimeVendorCss(await readVendor(process.cwd())) }); },
  };
}
// The harness belongs to the plugin project: serve and emit it at /harness/ as before the src project split.
const project = 'src/plugin/';
function harnessLayout() {
  return { name: 'fixture-harness-layout', enforce: 'post',
    configureServer(server) { server.middlewares.use((req, _res, next) => { if (req.url?.startsWith('/harness/')) req.url = '/' + project + req.url.slice(1); next(); }); },
    generateBundle: { order: 'post', handler(_options, bundle) {
      for (const [name, asset] of Object.entries(bundle)) {
        if (asset.type !== 'asset' || !name.startsWith(project)) continue;
        delete bundle[name];
        this.emitFile({ type: 'asset', fileName: name.slice(project.length), source: asset.source });
      }
    } },
  };
}
export default defineConfig(async ({ isPreview }) => {
  // Preview serves the qualified emitted assets, including __host.css. Running
  // build plugins here would rescan source/caches and rewrite generated inputs.
  if (isPreview) return { build: { outDir: 'dist-harness' } };
  const { sharedConfig } = await import('../../tooling/bundling/vite-shared.mjs');
  const config = sharedConfig();
  return { ...config, plugins: [...config.plugins, hostStyles(), harnessLayout()],
    build: { ...config.build, outDir: 'dist-harness', emptyOutDir: true, rolldownOptions: { input: 'src/plugin/harness/app/index.html' } },
    server: { host: '127.0.0.1', port: 4173, strictPort: true },
  };
});
