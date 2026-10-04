// Conservative checks for artifacts produced by our constrained HTML assembler.
// Not a general HTML parser, JS static analyzer, CSP audit or browser substitute.
function attrs(tag) {
  const result = new Map();
  const body = tag.replace(/^<\/?[\w:-]+/, '').replace(/\/?\s*>$/, '');
  const re = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  for (const match of body.matchAll(re)) result.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4]);
  return result;
}
function inlineAsset(value) { return /^(?:data:|blob:|#)/i.test(value.trim()); }
export function checkCss(css) {
  const issues = [];
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  if (/@import\b/i.test(stripped)) issues.push('CSS @import is forbidden');
  if (/@font-face\b/i.test(stripped)) issues.push('Font-face binaries are forbidden; use system fonts');
  for (const match of stripped.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)) {
    if (!inlineAsset(match[2])) issues.push(`External/relative CSS URL: ${match[2].slice(0, 120)}`);
  }
  if (/image-set\(/i.test(stripped)) issues.push('CSS image-set needs inlining/review');
  return issues;
}
export function checkHtml(html) {
  const issues = [];
  if (!/<!doctype html>/i.test(html)) issues.push('Missing HTML doctype');
  const scripts = [...html.matchAll(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi)];
  if (!scripts.length) issues.push('Missing bundled runtime');
  for (const script of scripts) {
    const tag = script[0].slice(0, script[0].indexOf('>') + 1);
    const attributes = attrs(tag);
    if (attributes.has('src')) issues.push('Script src is forbidden, even relative');
    const type = attributes.get('type') ?? '';
    if (['module', 'importmap'].includes(type)) issues.push(`Script type ${type} is forbidden`);
  }
  for (const match of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)) issues.push(...checkCss(match[1]));
  const markup = html.replace(/<!--([\s\S]*?)-->/g, '').replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '');
  for (const match of markup.matchAll(/<[a-z][^>]*>/gi)) {
    const tag = match[0];
    const name = tag.match(/^<([\w-]+)/)[1].toLowerCase();
    const attributes = attrs(tag);
    if (['iframe', 'object', 'embed', 'base'].includes(name)) issues.push(`Forbidden element: ${name}`);
    if (name === 'link' && attributes.has('href')) issues.push('External link resource is forbidden');
    if (name === 'meta' && (attributes.get('http-equiv') ?? '').toLowerCase() === 'refresh') issues.push('Meta refresh is forbidden');
    for (const [key, value] of attributes) {
      if (key.startsWith('on')) issues.push('Inline event handlers are forbidden');
      if (key === 'style') issues.push(...checkCss(value));
      if (['src', 'poster', 'xlink:href'].includes(key) && !inlineAsset(value)) issues.push(`Off-file ${key}: ${value.slice(0, 120)}`);
      if (['srcset', 'srcdoc', 'action', 'formaction'].includes(key)) issues.push(`Unsupported resource/action attribute: ${key}`);
      if (key === 'href' && name !== 'a' && !inlineAsset(value)) issues.push(`Off-file href on ${name}`);
    }
  }
  return [...new Set(issues)];
}
