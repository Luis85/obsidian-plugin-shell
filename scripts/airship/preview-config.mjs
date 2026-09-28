import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sharedConfig } from '../bundling/vite-shared.mjs';
import { airshipOptions } from '../companion/tooling-contract.mjs';
import { inspectorPlugin } from './inspector.mjs';
/** Only the source-preview entry uses development metadata; native/offline build configuration is unchanged. */
export function previewConfig(sourceRoot) {
  return ({ command }) => {
    const root = process.cwd();
    const document = JSON.parse(readFileSync(resolve(root, 'design/project.json'), 'utf8'));
    const options = airshipOptions(document.tooling);
    const config = sharedConfig();
    if (command !== 'serve') throw new Error('PREVIEW_SERVE_ONLY: Use build or build:clickdummy for distribution.');
    config.plugins.unshift(inspectorPlugin(root, sourceRoot), {
      name: 'shell-source-preview-document',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url === '/' || req.url?.startsWith('/?')) req.url = '/harness/prototype/index.html' + req.url.slice(1);
          next();
        });
      },
      transformIndexHtml(html, context) {
        if (!context.path.endsWith('/harness/prototype/index.html')) return html;
        const content = readFileSync(resolve(root, 'design/project.json'));
        if (content.byteLength > 4_000_000) throw new Error('COMPANION_LIMIT: Preview project exceeds 4 MB.');
        return { html, tags: [{ tag: 'script', attrs: { id: 'prototype-project-data', type: 'application/json' },
          children: JSON.stringify({ encoding: 'base64', content: content.toString('base64') }), injectTo: 'body' }] };
      },
    });
    return { ...config, root, cacheDir: 'node_modules/.vite-source-preview',
      define: { ...config.define, 'process.env.NODE_ENV': JSON.stringify('development'), 'import.meta.dev': true },
      server: { host: '127.0.0.1', port: options.targetPort, strictPort: true, cors: false,
        fs: { strict: true, allow: [root], deny: ['.env', '.env.*', '**/.git/**', '**/.airship/**', '**/.airship-tooling/**', '**/.hindsight/**', '**/.pg0/**', '**/.framework/**', '**/.obsidian/**', '**/.test-vault/**', '**/.dev-vault/**', '**/*.pem', '**/*.key'] } },
    };
  };
}
