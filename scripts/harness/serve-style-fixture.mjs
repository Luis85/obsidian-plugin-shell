/** Dedicated loopback server for the original stylesheet specimen only. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = new URL('../../', import.meta.url);
const routes = new Map([
  ['/', ['harness/style-fixture/index.html', 'text/html; charset=utf-8']],
  ['/harness/style-fixture/', ['harness/style-fixture/index.html', 'text/html; charset=utf-8']],
  ['/harness/style-fixture/index.html', ['harness/style-fixture/index.html', 'text/html; charset=utf-8']],
  ['/harness/style-fixture/fixture.css', ['harness/style-fixture/fixture.css', 'text/css; charset=utf-8']],
  ['/harness/style-fixture/fixture.js', ['harness/style-fixture/fixture.js', 'text/javascript; charset=utf-8']],
  ['/harness/styles/obsidian.css', ['harness/styles/obsidian.css', 'text/css; charset=utf-8']],
]);
for (const module of ['tokens', 'base', 'controls', 'overlays', 'accessibility']) {
  routes.set(`/harness/styles/obsidian/${module}.css`, [`harness/styles/obsidian/${module}.css`, 'text/css; charset=utf-8']);
}

export function createFixtureServer() {
  return createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'self'; script-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
    const raw = (request.url ?? '').split('?')[0];
    // Exact allowlist: no URL normalization, file traversal, or arbitrary vault access.
    const route = routes.get(raw);
    if (!route) { response.writeHead(404); response.end(); return; }
    if (raw === '/') { response.writeHead(302, { Location: '/harness/style-fixture/' }); response.end(); return; }
    try {
      const data = await readFile(new URL(route[0], root));
      response.writeHead(200, { 'Content-Type': route[1] });
      response.end(request.method === 'HEAD' ? undefined : data);
    } catch {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Fixture asset unavailable.');
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args[0] === '--help' && args.length === 1) {
    console.log('node scripts/harness/serve-style-fixture.mjs [--port 4174]');
  } else {
    const port = args.length === 0 ? 4174 : Number(args[1]);
    if ((args.length !== 0 && (args.length !== 2 || args[0] !== '--port')) || !Number.isInteger(port) || port < 1024 || port > 65535) {
      console.error('Expected --port with an integer from 1024 through 65535.');
      process.exitCode = 2;
    } else {
      const server = createFixtureServer();
      server.on('error', (error) => { console.error(`Fixture server failed: ${error.code ?? 'unknown'}`); process.exitCode = 1; });
      server.listen(port, '127.0.0.1', () => console.log(`Style fixture only: http://127.0.0.1:${port}/harness/style-fixture/`));
      const stop = () => { server.close(); server.closeAllConnections(); };
      process.once('SIGINT', stop);
      process.once('SIGTERM', stop);
    }
  }
}
