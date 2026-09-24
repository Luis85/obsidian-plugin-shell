/** Development-only application-port simulator. Never falls back to a live source. */
import { createFixtureEngine } from './engine.mjs';
export function createFixtureAdapter(manifest, options = {}) {
  const engine = createFixtureEngine(), generated = engine.generate(manifest, options);
  const clone = v => v === undefined ? undefined : structuredClone(v);
  const operations = new Map(generated.operations.map(op => [op.id, op]));
  const stores = new Map(), captures = [];
  let disposed = false;
  function error(message, status = 422) { const e = new Error(message); e.status = status; throw e; }
  function dataset(op) { return op.source + '/' + op.dataset; }
  function initialize() {
    stores.clear(); captures.length = 0;
    for (const op of operations.values()) {
      if (op.behavior !== 'list') continue;
      const id = dataset(op), schema = op.output.schema.items;
      const keySchema = schema.type === 'object' && schema.properties[op.keyField];
      if (!keySchema || !['string', 'integer', 'number'].includes(keySchema.type)) error('Stateful datasets require a scalar identity field on an object collection.');
      const previous = stores.get(id);
      if (previous && (JSON.stringify(previous.schema) !== JSON.stringify(schema) || previous.keyField !== op.keyField)) error('Incompatible list contracts share a test dataset.');
      const records = clone(op.outputValue);
      if (previous && JSON.stringify(previous.records) !== JSON.stringify(records)) error('Different list fixtures cannot initialize the same dataset. Use one list recipe per dataset.');
      if (new Set(records.map(r => r[op.keyField])).size !== records.length || records.some(r => r[op.keyField] === undefined)) error('Dataset identifiers must be present and unique.');
      stores.set(id, { schema, keyField: op.keyField, records });
    }
    for (const op of operations.values()) if (['upsert', 'delete'].includes(op.behavior)) {
      const store = stores.get(dataset(op));
      if (!store || store.keyField !== op.keyField) error('Stateful writes need a list recipe with the same source, dataset and identity key.');
      if (op.behavior === 'upsert' && !engine.matches(op.inputValue, store.schema)) error('Upsert input cannot satisfy its dataset schema. Declare an explicit mapping instead.');
    }
  }
  initialize();
  function check() { if (disposed) error('Test adapter has been disposed.', 410); }
  async function delay(ms, signal) {
    if (signal?.aborted) throw signal.reason || new Error('Aborted');
    if (!ms) return;
    await new Promise((resolve, reject) => {
      const cleanup = () => signal?.removeEventListener('abort', cancel);
      const timer = setTimeout(() => { cleanup(); resolve(); }, ms);
      const cancel = () => { clearTimeout(timer); cleanup(); reject(signal.reason || new Error('Aborted')); };
      signal?.addEventListener('abort', cancel, { once: true });
    });
  }
  async function execute(id, input, { signal } = {}) {
    check(); const op = operations.get(id);
    if (!op) error('Unknown or disabled test operation. Live fallback is forbidden.', 404);
    if (op.kind === 'vault') error('Vault recipes seed real notes. Use the generated plugin’s vault repository, not this memory adapter.', 400);
    if (op.input.none ? input !== undefined : !engine.matches(input, op.input.schema)) error('Input does not match the declared test operation contract.');
    await delay(op.scenario === 'slow' ? Math.max(1000, op.latencyMs) : op.latencyMs, signal);
    check(); if (signal?.aborted) throw signal.reason || new Error('Aborted');
    if (op.scenario === 'error') error('Deliberate synthetic failure.', op.errorStatus);
    const store = stores.get(dataset(op)); let output = clone(op.outputValue);
    if (op.behavior === 'list') output = clone(store.records);
    if (['upsert', 'delete'].includes(op.behavior)) {
      const k = input[op.keyField];
      if (!['string', 'number'].includes(typeof k)) error('A write needs the dataset identity key.');
      const index = store.records.findIndex(r => r[op.keyField] === k);
      if (op.behavior === 'delete') { if (index < 0) error('Synthetic record not found.', 404); store.records.splice(index, 1); }
      else {
        if (!engine.matches(input, store.schema)) error('Input needs an explicit mapping to the stored record shape.');
        if (index >= 0) store.records[index] = clone(input);
        else { if (store.records.length >= 1000) error('Test dataset capacity reached.', 409); store.records.push(clone(input)); }
      }
    }
    if (!op.output.none && !engine.matches(output, op.output.schema)) error('Simulator output violated its declared shape.', 500);
    captures.push({ operation: id, direction: op.direction, input: clone(input) }); if (captures.length > 100) captures.shift();
    return output;
  }
  function port(source) {
    const selected = [...operations.values()].filter(op => op.source === source && op.kind !== 'vault');
    if (!selected.length) error('No enabled simulator operations for this source.', 404);
    return Object.freeze(Object.fromEntries(selected.map(op => [op.slug, (input, options) => execute(op.id, input, options)])));
  }
  return Object.freeze({ execute, port, reset() { check(); initialize(); }, captured() { check(); return clone(captures); }, dispose() { disposed = true; stores.clear(); captures.length = 0; } });
}
