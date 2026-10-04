import { mapBounded } from '../../../scripts/shared/bounded-map.ts';
import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { readBounded, hash } from '../../adapters/framework/files.ts';
import { maintainerOnly, relocatedPath } from '../emitters/framework-docs.ts';
import { statIfPresent } from '../../../scripts/shared/fs-presence.ts';
import { prototypeSkillFiles } from '../../adapters/framework/prototype-skill.ts';
import { CompilerError, diagnostic } from '../domain/diagnostics.ts';
import type { Artifact, TemplateSnapshot } from '../domain/contracts.ts';
import { templateRootFiles, templateRoots } from '../domain/template-inputs.ts';

const invalid = (message: string) => new CompilerError(diagnostic('COMPILER_TEMPLATE_INVALID','emit',message));
/** Caches, maintainer-only inputs and files a generated project already holds at their relocated path
 * (docs/framework/...) are not framework input: the product's own README/AGENTS.md/CI are never read. */
async function excluded(root: string, path: string): Promise<boolean> {
  // bin/plugins holds the user's installed app plugins, never template input; only its developer guide ships.
  if ((path.startsWith('bin/plugins/') && path !== 'bin/plugins/DEVELOPER-GUIDE.md') || path.split('/').includes('__pycache__') || /\.py[co]$/.test(path) || maintainerOnly(path)) return true;
  const moved = relocatedPath(path);
  return moved !== path && await statIfPresent(join(root, moved)) !== null;
}
/** Read once into immutable data. Rendering never reopens a template or scans a directory. */
export async function loadTemplateSnapshot(root: string, signal?: AbortSignal): Promise<TemplateSnapshot> {
  root = resolve(root);
  const checkpoint = () => { if (signal?.aborted) throw new CompilerError(diagnostic('COMPILER_CANCELLED','parse','Template loading cancelled; no files were written.')); };
  checkpoint();
  const paths: string[] = [];
  let totalBytes = 0;
  async function copy(path: string): Promise<void> {
    checkpoint();
    if (await excluded(root, path)) return;
    const stat = await statIfPresent(join(root, path));
    if (!stat) throw invalid('Missing template input: ' + path);
    if (stat.isSymbolicLink()) throw invalid('GENERATOR_TEMPLATE_LINK: ' + path);
    if (stat.isDirectory()) { for (const name of (await readdir(join(root,path))).sort()) await copy(path + '/' + name); return; }
    if (/\.(?:ttf|otf|woff2?)$/i.test(path)) throw invalid('GENERATOR_TEMPLATE_FONT_NOT_SUPPORTED: ' + path);
    if (paths.length >= 5000) throw invalid('Template inventory exceeds its supported bound.');
    paths.push(path);
  }
  for (const path of templateRoots) await copy(path);
  // Only the shell checkout carries relocatable framework documents at the root; a generated project that
  // lacks a relocated copy simply has none.
  for (const path of templateRootFiles) if (relocatedPath(path) === path || await statIfPresent(join(root, path))) await copy(path);
  const files: Artifact[] = await mapBounded(paths, 8, async (path): Promise<Artifact> => {
    checkpoint();
    const bytes = await readBounded(join(root,path),8_000_000);
    checkpoint(); totalBytes += bytes.length;
    if (totalBytes > 120_000_000) throw invalid('Template inventory exceeds its supported bound.');
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
      if (!file || file.encoding) throw invalid('Missing text template: ' + path);
      return file.content;
    } });
}
