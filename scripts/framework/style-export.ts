import { assertJsonData } from '../contracts/json-data.mjs';
import { compileDesignSystem } from '../companion/design-system-css.mjs';
import { requireThat } from './contracts.ts';
/** Data-only renderer: same scoped compiler as project generation; never evaluates imported CSS or URLs. */
export function exportDesignSystem(system: unknown, pluginId: string, format: string) {
  requireThat(['css', 'json', 'markdown', 'html'].includes(format), 'STYLE_FORMAT', 'Choose css, json, markdown or html.');
  if (system !== undefined) assertJsonData(system);
  const compiled = compileDesignSystem(system, pluginId);
  const model = (system ?? {}) as Record<string, unknown>;
  const groups = ['fonts', 'typography', 'spacing', 'sizes', 'radii', 'colors', 'guidelines'];
  const rows = groups.flatMap(group => ((model[group] ?? []) as Record<string, unknown>[])
    .map(token => ({ group, token })).sort((a, b) => String(a.token.id) < String(b.token.id) ? -1 : String(a.token.id) > String(b.token.id) ? 1 : 0));
  const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
  const markdown = (value: unknown) => escape(value).replace(/[\\`*_{}\[\]()#+.!|~-]/g, '\\$&').replace(/\r?\n/g, '<br>');
  const tokenValue = (token: Record<string, unknown>) => JSON.stringify(Object.fromEntries(Object.entries(token).filter(([key]) => !['id', 'name', 'usage'].includes(key)).sort(([a], [b]) => a < b ? -1 : 1)));
  let content: string, extension: string, mediaType: string;
  if (format === 'css') { content = compiled.css; extension = 'css'; mediaType = 'text/css'; }
  else if (format === 'json') { content = JSON.stringify({ schemaVersion: 1, designSystem: system ?? null, manifest: compiled.manifest }, null, 2) + '\n'; extension = 'json'; mediaType = 'application/json'; }
  else if (format === 'markdown') {
    content = `# ${markdown(model.name ?? 'Design system')}\n\n${markdown(model.description)}\n\n${markdown(model.principles)}\n\nScope: ${markdown(compiled.manifest.scope)}\n\n| Group | Token | Declaration | Usage |\n| --- | --- | --- | --- |\n`;
    content += rows.map(({ group, token }) => `| ${markdown(group)} | ${markdown(token.name)} | ${markdown(tokenValue(token))} | ${markdown(token.usage)} |`).join('\n') + '\n';
    extension = 'md'; mediaType = 'text/markdown';
  } else {
    content = '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">';
    content += `<title>${escape(model.name ?? 'Design system')}</title><style>body{font:16px/1.6 system-ui,sans-serif;margin:2rem;max-width:80rem}table{border-collapse:collapse;width:100%}th,td{text-align:left;vertical-align:top;border-bottom:1px solid;padding:.75rem;overflow-wrap:anywhere}code{white-space:pre-wrap}p{white-space:pre-wrap}</style></head><body>`;
    content += `<h1>${escape(model.name ?? 'Design system')}</h1><p>${escape(model.description)}</p><p>${escape(model.principles)}</p><p>Scope: <code>${escape(compiled.manifest.scope)}</code></p><table><thead><tr><th>Group</th><th>Token</th><th>Declaration</th><th>Usage</th></tr></thead><tbody>`;
    content += rows.map(({ group, token }) => `<tr><td>${escape(group)}</td><td>${escape(token.name)}</td><td><code>${escape(tokenValue(token))}</code></td><td>${escape(token.usage)}</td></tr>`).join('');
    content += '</tbody></table><p>Named fonts reference local or host families only. No remote assets are loaded. Guidelines are documentation, not executable styles.</p></body></html>\n';
    extension = 'html'; mediaType = 'text/html';
  }
  return { content, extension, mediaType, manifest: compiled.manifest };
}
