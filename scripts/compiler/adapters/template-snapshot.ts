import { mapBounded } from '../../shared/bounded-map.mjs';
import { lstat, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { readBounded, hash } from '../../framework/files.ts';
import { maintainerOnly } from '../../companion/compiler/framework-docs.ts';
import { prototypeSkillFiles } from '../../companion/prototype-skill.mjs';
import { CompilerError, diagnostic } from '../domain/diagnostics.ts';
import type { Artifact, TemplateSnapshot } from '../domain/contracts.ts';

const roots = ['src', 'scripts', 'tests', 'harness', 'docs', '.github', 'bin'];
const rootFiles = ['package.json','package-lock.json','manifest.json','versions.json','tsconfig.json','vite.config.mjs',
  'vite.harness.config.mjs','vitest.config.mjs','vitest.production.config.mjs','playwright.config.ts','eslint.config.mjs',
  '.fallowrc.json','.oxlintrc.json','.gitignore','.nvmrc','AGENTS.md','LICENSE','README.md','TEMPLATE-GUIDE.md',
  'SHELL-FIRST-OVERVIEW.md','shell.mjs','vitest.obsidian.config.mjs','tsconfig.generator.json','tsconfig.framework.json', 'tsconfig.maker.json', 'vitest.maker.config.mjs','tsconfig.sitemap.json','tsconfig.authoring.json'];
/** Read once into immutable data. Rendering never reopens a template or scans a directory. */
export async function loadTemplateSnapshot(root: string, signal?: AbortSignal): Promise<TemplateSnapshot> {
  root = resolve(root);
  const checkpoint = () => { if (signal?.aborted) throw new CompilerError(diagnostic('COMPILER_CANCELLED','parse','Template loading cancelled; no files were written.')); };
  checkpoint();
  const paths: string[] = [];
  let totalBytes = 0;
  async function copy(path: string): Promise<void> {
    checkpoint();
    if (path.split('/').includes('__pycache__') || /\.py[co]$/.test(path) || maintainerOnly(path)) return;
    const stat = await lstat(join(root, path));
    if (stat.isSymbolicLink()) throw new CompilerError(diagnostic('COMPILER_TEMPLATE_INVALID','emit','GENERATOR_TEMPLATE_LINK: ' + path));
    if (stat.isDirectory()) { for (const name of (await readdir(join(root,path))).sort()) await copy(path + '/' + name); return; }
    if (/\.(?:ttf|otf|woff2?)$/i.test(path)) throw new CompilerError(diagnostic('COMPILER_TEMPLATE_INVALID','emit','GENERATOR_TEMPLATE_FONT_NOT_SUPPORTED: ' + path));
    if (paths.length >= 5000) throw new CompilerError(diagnostic('COMPILER_TEMPLATE_INVALID','emit','Template inventory exceeds its supported bound.'));
    paths.push(path);
  }
  for (const path of [...roots,...rootFiles]) await copy(path);
  const files: Artifact[] = await mapBounded(paths, 8, async (path): Promise<Artifact> => {
    checkpoint();
    const bytes = await readBounded(join(root,path),8_000_000);
    checkpoint(); totalBytes += bytes.length;
    if (totalBytes > 120_000_000) throw new CompilerError(diagnostic('COMPILER_TEMPLATE_INVALID','emit','Template inventory exceeds its supported bound.'));
    return { path, content: path.endsWith('.gz') ? bytes.toString('base64') : new TextDecoder('utf-8',{fatal:true}).decode(bytes),
      ...(path.endsWith('.gz') ? {encoding:'base64' as const} : {}), ownership:'framework', producer:'framework' };
  });
  const skillFiles: Artifact[] = (await prototypeSkillFiles(root)).map((file: {path:string;bytes:Buffer}) => ({
    path:file.path,content:file.bytes.toString('utf8'),ownership:'extension',producer:'devkit' }));
  checkpoint();
  const all = [...files,...skillFiles].sort((a,b)=>a.path < b.path ? -1 : 1);
  const texts = new Map(all.map(file=>[file.path,file]));
  const fingerprint = hash(JSON.stringify(all.map(file=>[file.path,hash(Buffer.from(file.content,file.encoding ?? 'utf8'))])));
  for (const file of all) Object.freeze(file);
  return Object.freeze({ fingerprint,frameworkFiles:Object.freeze(files),skillFiles:Object.freeze(skillFiles),
    text(path:string) {
      const file=texts.get(path);
      if (!file || file.encoding) throw new CompilerError(diagnostic('COMPILER_TEMPLATE_INVALID','emit','Missing text template: ' + path));
      return file.content;
    } });
}
