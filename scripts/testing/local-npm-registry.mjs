// Test-only registry: serves exactly the supplied synthetic packages on loopback.
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

export function startFixtureRegistry(packages) {
  const worker = new Worker(new URL(import.meta.url), { workerData: packages, execArgv: [] });
  return new Promise((resolve, reject) => {
    const fail = error => { clearTimeout(timer); void worker.terminate(); reject(error); };
    const timer = setTimeout(() => fail(new Error('Fixture registry readiness timed out')), 10000);
    worker.once('error', fail);
    worker.once('exit', code => { if (code) fail(new Error(`Fixture registry exited ${code}`)); });
    worker.once('message', url => {
      clearTimeout(timer);
      resolve({ url, close: () => worker.terminate() });
    });
  });
}

if (!isMainThread) {
  const packages = new Map();
  for (const entry of workerData) {
    const body = await readFile(entry.tarball);
    packages.set(entry.name, { ...entry, body,
      shasum: createHash('sha1').update(body).digest('hex'),
      integrity: `sha512-${createHash('sha512').update(body).digest('base64')}` });
  }
  let origin;
  const server = createServer((request, response) => {
    const path = (request.url ?? '').split('?')[0];
    if (request.method !== 'GET') { response.writeHead(405).end(); return; }
    for (const entry of packages.values()) {
      const tarPath = `/${entry.name}/-/${entry.name}-1.0.0.tgz`;
      if (path === tarPath) {
        response.writeHead(200, { 'content-type': 'application/octet-stream' }).end(entry.body); return;
      }
      if (path === `/${entry.name}`) {
        const version = { name: entry.name, version: '1.0.0',
          scripts: { postinstall: 'node hook.cjs' }, hasInstallScript: true,
          dist: { tarball: `${origin}${tarPath}`, shasum: entry.shasum, integrity: entry.integrity } };
        response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({
          name: entry.name, 'dist-tags': { latest: '1.0.0' }, versions: { '1.0.0': version },
        })); return;
      }
    }
    response.writeHead(404).end();
  });
  server.listen(0, '127.0.0.1', () => {
    origin = `http://127.0.0.1:${server.address().port}`;
    parentPort.postMessage(origin);
  });
}
