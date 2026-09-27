import path from 'node:path';
import vm from 'node:vm';
import { args, need, readText, readBytes, sha256, writeBuild, noLinks, isMain, cli } from './lib/io.mjs';
import { checkCss, checkHtml } from './lib/offline.mjs';
function escape(value) { return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
export function assemble({ javascript, css, projectBytes, title }) {
  if (!javascript.trim()) throw new Error('Compiled JavaScript is empty');
  if (!title || title.length > 160 || /[\r\n]/.test(title)) throw new Error('Use a single-line title of at most 160 characters');
  if (javascript.includes('<!--')) throw new Error('Escape/remove HTML comment sequences from compiled JavaScript');
  new vm.Script(javascript, { filename: 'compiled-prototype.js' }); // syntax only; no execution
  if (/\bimport\s*\(/.test(javascript)) throw new Error('Dynamic imports must be inlined');
  if (/sourceMappingURL\s*=/.test(javascript)) throw new Error('Remove sourceMappingURL from delivery JS');
  if (projectBytes.length > 4_000_000) throw new Error('Project JSON exceeds 4 MB');
  const project = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(projectBytes));
  if (project.kind !== 'obsidian-companion-project' || project.executable !== false) {
    throw new Error('Expected non-executable full companion project; run real validator separately');
  }
  const cssIssues = checkCss(css);
  if (cssIssues.length) throw new Error(cssIssues.join('; '));
  if (/<\/style/i.test(css)) throw new Error('CSS contains an HTML style closing sequence');
  const js = javascript.replace(/<\/script/gi, '<\\/script');
  new vm.Script(js);
  const scriptHash = Buffer.from(sha256(js), 'hex').toString('base64');
  const policy = `default-src 'none'; script-src 'sha256-${scriptHash}'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
  const data = JSON.stringify({ encoding: 'base64', sha256: sha256(projectBytes), content: projectBytes.toString('base64') });
  const html = `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${escape(policy)}"><title>${escape(title)}</title><style>${css}</style></head><body><div id="prototype-app" class="prototype-root"></div><script id="prototype-project-data" type="application/json">${data}</script><script>${js}</script></body></html>\n`;
  const issues = checkHtml(html);
  if (issues.length) throw new Error(issues.join('; '));
  return html;
}
if (isMain(import.meta.url)) cli(() => {
  const options = args(process.argv.slice(2), ['--js', '--css', '--project', '--out', '--title'], ['--replace', '--help']);
  if (options.help) return console.log('Usage: node build-single-file.mjs --js <compiled-iife.js> --css <scoped.css> --project <project.json> --out <new.html> --title <title> [--replace]');
  const inputs = ['js', 'css', 'project'].map(key => noLinks(need(options, key)));
  const out = noLinks(need(options, 'out'));
  if (inputs.includes(out)) throw new Error('Output must not replace an input');
  const html = assemble({ javascript: readText(inputs[0]), css: readText(inputs[1]),
    projectBytes: readBytes(inputs[2], 4_000_000), title: need(options, 'title') });
  writeBuild(out, html, Boolean(options.replace));
  console.log(JSON.stringify({ artifact: path.basename(out), bytes: Buffer.byteLength(html), sha256: sha256(html),
    status: 'assembled-not-browser-verified' }, null, 2));
});
