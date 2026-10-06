/** Console/page-error capture for real Obsidian pages. Attribution is a heuristic
 * over Obsidian's `plugin:<id>` script URL and stack frames, not a security boundary. */
const levels = new Map([['error', 'error'], ['assert', 'error'], ['warning', 'warn'], ['warn', 'warn'], ['info', 'info'], ['log', 'log'], ['debug', 'debug'], ['trace', 'debug']]);
const maxText = 4000; const maxStack = 6000;

export function consoleEntry(kind, details, now = () => new Date().toISOString()) {
  const level = kind === 'pageerror' ? 'error' : levels.get(details.type) ?? 'log';
  return Object.freeze({ at: now(), kind, level, text: String(details.text ?? '').slice(0, maxText),
    url: typeof details.url === 'string' ? details.url.slice(0, 500) : '',
    stack: typeof details.stack === 'string' ? details.stack.slice(0, maxStack) : '', page: details.page ?? 0 });
}
export function belongsToPlugin(entry, pluginId) {
  if (entry.plugin === true) return true;
  if (!pluginId) return false;
  const marker = `plugin:${pluginId}`;
  return entry.url.includes(marker) || entry.stack.includes(marker) || entry.text.includes(marker)
    || entry.text.startsWith(`[${pluginId}]`);
}
/** `plugin` keeps attributed entries plus every error; `all` keeps everything. */
export function selectEntries(entries, { pluginId, mode = 'plugin' } = {}) {
  if (!['plugin', 'all'].includes(mode)) throw new Error('CONSOLE_FILTER_INVALID');
  return entries.filter(entry => mode === 'all' || entry.level === 'error' || belongsToPlugin(entry, pluginId));
}
/** Collapse repeated failures (same text and first frame) into one line with a count. */
export function dedupeEntries(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const key = `${entry.level}|${entry.text}|${entry.stack.split('\n')[0] ?? ''}`;
    const group = groups.get(key);
    if (group) group.count++; else groups.set(key, { entry, count: 1 });
  }
  return [...groups.values()];
}
/** Failures for a load/reload window: any uncaught page error plus plugin-attributed console errors. */
export function loadErrors(entries, pluginId) {
  return entries.filter(entry => entry.level === 'error' && (entry.kind === 'pageerror' || belongsToPlugin(entry, pluginId)));
}
export function formatEntry(entry, pluginId) {
  const tag = belongsToPlugin(entry, pluginId) ? pluginId : 'host';
  const head = `${entry.at} ${entry.level.toUpperCase().padEnd(5)} [${tag}]${entry.kind === 'pageerror' ? ' uncaught' : ''} ${entry.text}`;
  const stack = entry.stack && !entry.text.includes(entry.stack) ? `\n${entry.stack.split('\n').map(line => `    ${line.trim()}`).join('\n')}` : '';
  return head + stack;
}
function stackOf(message) {
  const location = message.location?.();
  // Playwright locations are 0-based; stack frames are 1-based.
  return location?.url ? `at ${location.url}:${(location.lineNumber ?? 0) + 1}:${(location.columnNumber ?? 0) + 1}` : '';
}
/** Records console messages and uncaught errors (including unhandled rejections) from every page. */
export function createConsoleRecorder({ pluginId, onEntry = () => undefined, transform = entry => entry, limit = 5000 } = {}) {
  const entries = []; const pages = new Map(); let disposed = false; let sequence = 0;
  const push = recorded => {
    // Attribute before mapping: source-mapped frames no longer contain `plugin:<id>`.
    const plugin = belongsToPlugin(recorded, pluginId);
    let mapped = recorded;
    try { mapped = transform(recorded); } catch { /* Keep the unmapped entry. */ }
    const entry = Object.freeze({ ...mapped, plugin, sequence: sequence++ });
    entries.push(entry); if (entries.length > limit) entries.shift();
    try { onEntry(entry); } catch { /* A sink failure never hides the recorded entry. */ }
  };
  return {
    entries,
    attach(page) {
      if (disposed || pages.has(page)) return;
      const id = pages.size + 1;
      const onConsole = message => push(consoleEntry('console', { type: message.type(), text: message.text(), url: message.location?.()?.url, stack: stackOf(message), page: id }));
      const onError = error => push(consoleEntry('pageerror', { text: `${error.name ?? 'Error'}: ${error.message}`, stack: error.stack ?? '', page: id }));
      page.on('console', onConsole); page.on('pageerror', onError);
      pages.set(page, { onConsole, onError });
    },
    attachContext(context) {
      for (const page of context.pages()) this.attach(page);
      const onPage = page => this.attach(page);
      context.on('page', onPage);
      return () => context.off('page', onPage);
    },
    errors: () => entries.filter(entry => entry.level === 'error'),
    pluginEntries: () => entries.filter(entry => belongsToPlugin(entry, pluginId)),
    text: (mode = 'all') => selectEntries(entries, { pluginId, mode }).map(entry => formatEntry(entry, pluginId)).join('\n'),
    mark: () => sequence,
    since: mark => entries.filter(entry => entry.sequence >= mark),
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const [page, { onConsole, onError }] of pages) { page.off('console', onConsole); page.off('pageerror', onError); }
      pages.clear();
    },
  };
}
