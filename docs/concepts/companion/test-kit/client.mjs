/** Development-only HTTP port. Explicit loopback URL/token; never contacts a live endpoint. */
import { createFixtureEngine } from './engine.mjs';
export function createTestHttpPort(manifest, source, { url, token, transport = fetch, timeoutMs = 8000 } = {}) {
  const engine = createFixtureEngine(); engine.validate(manifest);
  const base = new URL(url);
  if (base.protocol !== 'http:' || base.hostname !== '127.0.0.1' || !base.port || base.username || base.password || base.search || base.hash || base.pathname !== '/') throw new Error('An explicit loopback origin is required. Live fallback is forbidden.');
  if (!/^[a-f0-9]{48}$/.test(token || '') || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000) throw new Error('Invalid test-session token or timeout.');
  const ops = manifest.operations.filter(op => op.kind === 'api' && op.source === source);
  if (!ops.length) throw new Error('No enabled API recipes for this source.');
  let disposed = false; const pending = new Set();
  async function call(op, input, { signal } = {}) {
    if (disposed) throw new Error('Test HTTP port is disposed.');
    if (op.input.none ? input !== undefined : !engine.matches(input, op.input.schema)) throw new Error('Input violates the test contract.');
    const consumed = new Set(), path = op.resource.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (_, key) => {
      if (!input || !['string', 'number', 'boolean'].includes(typeof input[key])) throw new Error('A path parameter needs an explicit scalar input field.');
      consumed.add(key); return encodeURIComponent(String(input[key]));
    });
    const target = new URL('/sources/' + op.source + path, base);
    if (['GET', 'HEAD'].includes(op.method) && input !== undefined) for (const [key, value] of Object.entries(input)) if (!consumed.has(key)) target.searchParams.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    const controller = new AbortController(), abort = () => controller.abort(signal.reason); pending.add(controller);
    if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => controller.abort(new Error('Test HTTP timeout.')), timeoutMs);
    try {
      const response = await transport(target.href, { method: op.method, redirect: 'error', credentials: 'omit', cache: 'no-store', signal: controller.signal, headers: { Authorization: 'Bearer ' + token, ...(!['GET', 'HEAD'].includes(op.method) && input !== undefined ? { 'Content-Type': 'application/json' } : {}) }, ...(!['GET', 'HEAD'].includes(op.method) && input !== undefined ? { body: JSON.stringify(input) } : {}) });
      if (!response.ok) { const error = new Error('Test HTTP response ' + response.status); error.status = response.status; throw error; }
      const text = await response.text(); if (text.length > 5000000) throw new Error('Test response exceeds 5 MB.');
      const output = text ? JSON.parse(text) : undefined;
      if (op.output.none ? output !== undefined : !engine.matches(output, op.output.schema)) throw new Error('Test HTTP output violates the declared contract.');
      return output;
    } finally { clearTimeout(timer); pending.delete(controller); signal?.removeEventListener('abort', abort); }
  }
  return Object.freeze({ port: Object.freeze(Object.fromEntries(ops.map(op => [op.slug, (input, options) => call(op, input, options)]))), dispose() { disposed = true; for (const controller of pending) controller.abort(new Error('Test HTTP port disposed.')); pending.clear(); } });
}
