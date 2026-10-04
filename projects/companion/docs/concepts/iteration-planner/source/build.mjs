/** Dependency-free fallback assembler. This is not the repository's Vue/Nuxt build. */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import { gzipSync } from 'node:zlib';
const modules = ['model','validation','commands','fixtures','ui','overview','planning','ceremonies','dialogs','app'];
const built = new Set();
const chunks = [];
for (const name of modules) {
  const input = await readFile(new URL(`./${name}.ts`,import.meta.url),'utf8');
  let code = stripTypeScriptTypes(input,{mode:'strip'});
  const exports = [...code.matchAll(/\bexport\s+(?:function|const|let|class)\s+(\w+)/g)].map(match=>match[1]);
  code = code.replace(/import\s*\{([^}]+)\}\s*from\s*['"]\.\/([^'"]+)\.ts['"];?/g,(_match,names,dependency)=>{
    if(!built.has(dependency))throw new Error(`Unresolved dependency ${dependency} in ${name}`);
    return `const {${names}} = modules[${JSON.stringify(dependency)}];`;
  });
  code = code.replace(/\bexport\s+(?=(?:function|const|let|class)\s)/g,'');
  if(/^\s*(?:import\s+|export\s+)/m.test(code))throw new Error(`Unsupported module syntax in ${name}`);
  chunks.push(`modules[${JSON.stringify(name)}] = (() => {\n${code}\nreturn {${exports.join(',')}};\n})();`);
  built.add(name);
}
const script = `(() => {\n'use strict';\nconst modules = Object.create(null);\n${chunks.join('\n')}\n})();`.replace(/<\/script/gi,'<\\/script');
const css = await readFile(new URL('./styles.css',import.meta.url),'utf8');
const frame = await readFile(new URL('./frame.html',import.meta.url),'utf8');
const compressed = gzipSync(JSON.stringify({script,css}),{level:9}).toString('base64');
const loader = `(async () => {
  try {
    if (typeof DecompressionStream !== 'function') throw new Error('Open this prototype in a current browser with DecompressionStream support.');
    const bytes = Uint8Array.from(atob(document.getElementById('prototype-bundle').textContent.trim()), value => value.charCodeAt(0));
    const bundle = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).json();
    const style = document.createElement('style'); style.textContent = bundle.css; document.head.append(style);
    const application = document.createElement('script'); application.textContent = bundle.script; document.body.append(application);
  } catch (error) {
    document.getElementById('app').textContent = 'The prototype could not start. ' + (error instanceof Error ? error.message : 'Rebuild it from the supplied sources.');
  }
})();`;
const hashPolicy = value => `'sha256-${createHash('sha256').update(value).digest('base64')}'`;
const policy = [hashPolicy(loader),hashPolicy(script)].join(' ');
const html = frame.replace('__SCRIPT_POLICY__',policy).replace('/*__STYLES__*/','body{font-family:system-ui,sans-serif}')
  .replace('/*__BUNDLE__*/',loader).replace('<!--__PAYLOAD__-->',`<script id="prototype-bundle" type="application/octet-stream">${compressed}</script>`);
const output = new URL('../prototype.html',import.meta.url);
if(process.argv.includes('--check')) {
  const existing = await readFile(output,'utf8');
  if(existing!==html)throw new Error('prototype.html differs from its supplied source. Run npm run prototype:build.');
} else await writeFile(output,html,'utf8');
console.log(`${process.argv.includes('--check')?'Checked':'Built'} prototype.html: ${Buffer.byteLength(html)} bytes; SHA-256 ${createHash('sha256').update(html).digest('hex')}`);
