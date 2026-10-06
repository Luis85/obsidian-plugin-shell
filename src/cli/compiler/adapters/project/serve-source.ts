/** Local-only built-app preview. Starting is explicit; compilation and setup never open a server. */
export function serveSource(configPath: string): string {
  return String.raw`import { preview } from 'vite';
import { readFile, access } from 'node:fs/promises';
const config = JSON.parse(await readFile(${JSON.stringify(configPath)}, 'utf8'));
const target = config.targets.find(value => value === 'webapp' || value === 'website');
if (!target) throw new Error('A browser target is required.');
if (process.argv.length > 2) throw new Error('Set PORT in the environment; command arguments are not supported.');
const port = Number(process.env.PORT ?? 4173);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT must be an integer between 1024 and 65535.');
await access('dist/' + target + '/index.html');
const server = await preview({ configFile: false, root: process.cwd(), publicDir: false,
  build: { outDir: 'dist/' + target }, preview: { host: '127.0.0.1', port, strictPort: true, open: false } });
server.printUrls();
let closing = false;
function close() {
  if (closing) return;
  closing = true;
  server.httpServer.close(error => { process.exitCode = error ? 1 : 0; });
}
process.once('SIGINT', close);
process.once('SIGTERM', close);
`;
}
