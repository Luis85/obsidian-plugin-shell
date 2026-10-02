import { SourceMap } from 'node:module';

/** Obsidian 1.13 evaluates main.js as `(function anonymous(require,module,exports){<code>` with
 * `//# sourceURL=plugin:<id>`, so line 1 columns carry this wrapper prefix. Verified against 1.13.7. */
export const PLUGIN_WRAPPER_PREFIX = '(function anonymous(require,module,exports){';

export function inlineSourceMap(code) {
  const match = /\/\/# sourceMappingURL=data:application\/json;(?:charset=utf-8;)?base64,([A-Za-z0-9+/=]+)\s*$/.exec(code);
  if (!match) return null;
  try { return new SourceMap(JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'))); }
  catch { return null; }
}
function sourceName(fileName) {
  return fileName.replace(/^[a-z]+:\/\/\/?/i, '').replace(/^(?:\.\.\/)+/, '').replace(/^\/+/, '');
}
/** Replace `plugin:<id>:line:column` frames with original `src/...:line:column` positions. */
export function mapPluginStack(text, map, pluginId) {
  if (!map || !text || !pluginId) return text;
  const id = encodeURIComponent(pluginId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(?:app://obsidian\\.md/)?plugin:${id}:(\\d+):(\\d+)`, 'g');
  return text.replace(pattern, (whole, line, column) => {
    const lineNumber = Number(line);
    const columnNumber = Number(column) - (lineNumber === 1 ? PLUGIN_WRAPPER_PREFIX.length : 0);
    if (columnNumber < 1) return whole;
    const origin = map.findOrigin(lineNumber, columnNumber);
    if (!origin?.fileName) return whole;
    return `${sourceName(origin.fileName)}:${origin.lineNumber}:${origin.columnNumber}`;
  });
}
