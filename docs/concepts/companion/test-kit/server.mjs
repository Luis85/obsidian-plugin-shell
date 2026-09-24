/** Loopback HTTP simulator: explicit start, bounded bodies, token required, no proxy. */
import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createFixtureAdapter } from './adapters.mjs';
export async function startFixtureServer(manifest, { port = 0, ...options } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid loopback port.');
  const adapter = createFixtureAdapter(manifest, options), token = randomBytes(24).toString('hex');
  const operations = manifest.operations.filter(op => op.kind === 'api');
  const routes = new Set();
  for (const op of operations) {
    const normalized = op.method + ':' + op.source + op.resource.replace(/\{[^}]+\}/g, '{}');
    if (routes.has(normalized)) throw new Error('Ambiguous mock route. Use distinct method/resource contracts.');
    routes.add(normalized);
  }
  function route(op, pathname) {
    const expected = ('/sources/' + op.source + op.resource).split('/'), actual = pathname.split('/');
    if (expected.length !== actual.length) return null;
    const params = {};
    for (let i = 0; i < expected.length; i++) {
      if (/^\{[a-zA-Z][a-zA-Z0-9_]*\}$/.test(expected[i])) params[expected[i].slice(1, -1)] = decodeURIComponent(actual[i]);
      else if (expected[i] !== actual[i]) return null;
    }
    return params;
  }
  async function body(req) {
    let size = 0; const buffers = [];
    for await (const chunk of req) { size += chunk.length; if (size > 65536) { const e = new Error('Test request exceeds 64 KiB.'); e.status = 413; throw e; } buffers.push(chunk); }
    const text = Buffer.concat(buffers).toString('utf8');
    if (!text) return undefined;
    try { return JSON.parse(text); } catch { const e = new Error('Invalid JSON input.'); e.status = 400; throw e; }
  }
  function decode(text, schema) {
    if (schema?.type === 'string') return text;
    try { return JSON.parse(text); } catch { return text; }
  }
  function send(res, status, data, head = false) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(head || data === undefined ? '' : JSON.stringify(data));
  }
  const server = http.createServer({ maxHeaderSize: 8192, requestTimeout: 10000, headersTimeout: 10000 }, async (req, res) => {
    const abort = new AbortController(); res.on('close', () => abort.abort());
    try {
      const host = `127.0.0.1:${server.address().port}`;
      if (req.headers.host !== host || req.headers.origin && req.headers.origin !== 'app://obsidian.md') return send(res, 403, { error: 'Local test requests only.' });
      if (req.headers.origin === 'app://obsidian.md') {
        res.setHeader('Access-Control-Allow-Origin', 'app://obsidian.md'); res.setHeader('Vary', 'Origin');
        if (req.method === 'OPTIONS') {
          const method = req.headers['access-control-request-method'];
          const requested = (req.headers['access-control-request-headers'] || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
          if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].includes(method) || requested.some(k => !['authorization', 'content-type'].includes(k))) return send(res, 403, { error: 'Unsupported test preflight.' });
          res.setHeader('Access-Control-Allow-Methods', method); res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type'); return send(res, 204);
        }
      }
      const provided = Buffer.from(req.headers.authorization || ''), expected = Buffer.from('Bearer ' + token);
      if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return send(res, 401, { error: 'Explicit test-session token required.' });
      const url = new URL(req.url, 'http://' + host);
      if (url.host !== host) return send(res, 403, { error: 'Live proxying is forbidden.' });
      const matches = operations.map(op => ({ op, params: route(op, url.pathname) })).filter(x => x.params !== null && x.op.method === req.method);
      if (matches.length !== 1) return send(res, 404, { error: 'No unambiguous enabled fixture route.' });
      const { op, params } = matches[0]; let input;
      if (['GET', 'HEAD'].includes(req.method)) {
        if ([...url.searchParams.keys()].some(k => Object.hasOwn(params, k) || url.searchParams.getAll(k).length !== 1)) return send(res, 422, { error: 'Path identifiers and query fields must be unambiguous.' });
        const values = { ...params, ...Object.fromEntries(url.searchParams) };
        input = op.input.none && !Object.keys(values).length ? undefined : Object.fromEntries(Object.entries(values).map(([k, v]) => [k, decode(v, op.input.schema?.properties?.[k])]));
      } else {
        input = await body(req);
        // Path identifiers must also be declared in the JSON input, not silently injected.
        if (Object.keys(params).some(k => String(input?.[k]) !== params[k])) return send(res, 422, { error: 'Body identity must match the declared path parameter.' });
      }
      const output = await adapter.execute(op.id, input, { signal: abort.signal });
      if (!res.destroyed) send(res, 200, output, req.method === 'HEAD');
    } catch (error) { if (!res.destroyed) send(res, error.status || 500, { error: error.status ? error.message : 'Synthetic adapter failure.' }); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); }); });
  return { url: `http://127.0.0.1:${server.address().port}`, token, adapter, async close() { adapter.dispose(); await new Promise((resolve, reject) => { server.close(e => e ? reject(e) : resolve()); server.closeAllConnections(); }); } };
}
