import { lstat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createFilePlan } from '../shared/file-plan.mjs';
import { slug, title } from './arguments.mjs';
import { templates } from './templates.mjs';
import { readRegistry, extendRegistry, validateRegistrySource } from './registry.mjs';

export async function planMaker(root, { maker, name, options }, { beforeFinalize } = {}) {
  if (!['feature', 'entity'].includes(maker)) throw new Error('Unknown maker. Use --list for the implemented catalog.');
  if (maker === 'feature' && options['--feature'] !== undefined) throw new Error('--feature belongs to the entity recipe; feature uses its positional group name');
  if (maker === 'entity' && options['--entity'] !== undefined) throw new Error('--entity belongs to the feature recipe; entity uses its positional entity name');
  const owner = slug(maker === 'feature' ? name : options['--feature'], 'feature name');
  const entity = slug(maker === 'entity' ? name : options['--entity'], 'entity name (--entity is required for feature)');
  if (maker === 'entity' && !options['--document']) throw new Error('This bounded entity maker requires --document. Domain-only entities use the manual defineEntity API.');
  const folder = options['--folder'] ?? title(owner); const preset = options['--preset'] ?? 'title';
  if (!['title', 'task', 'project'].includes(preset)) throw new Error('Unknown preset; select title, task or project');
  if (typeof folder !== 'string' || folder.length > 160 || folder !== folder.trim() || folder.split('/').some(part => !part || part.startsWith('.') || /[<>:"|?*\\\u0000-\u001f]/.test(part) || /[ .]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) throw new Error('Unsafe document folder');
  const generated = templates({ owner, entity, folder, preset });
  const generatedPlan = await createFilePlan(root, generated.entries);
  for (const change of generatedPlan.changes) if (change.status === 'update') throw new Error(`MAKER_CONFLICT: edited or unrelated file ${change.path}`);
  await createFilePlan(root, [{ path: 'src/bootstrap/features.ts', content: null }]);
  const registry = await readRegistry(root);
  const nextRegistry = extendRegistry(registry, { key: generated.name, local: generated.feature, from: `../features/${owner}/${entity}.definition` });
  await validateRegistrySource(nextRegistry);
  let ownerExists = false;
  try { const entry = await lstat(resolve(root, 'src/features', owner)); if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error('Feature owner must be a real directory'); ownerExists = true; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (maker === 'entity' && !ownerExists) throw new Error(`Feature ${owner} does not exist. Create it first with make feature ${owner} --entity <name>.`);
  const allExisting = generatedPlan.changes.every(change => change.beforeHash !== null);
  if (maker === 'feature' && ownerExists && !allExisting) throw new Error(`Feature ${owner} already exists. Use make entity to add another note entity.`);
  await beforeFinalize?.();
  const plan = await createFilePlan(root, [...generated.entries, { path: registry.path, content: nextRegistry }]);
  const reviewed = new Map(generatedPlan.changes.map(change => [change.path, change.beforeHash]));
  reviewed.set(registry.path, createHash('sha256').update(registry.source).digest('hex'));
  for (const change of plan.changes) if (reviewed.get(change.path) !== change.beforeHash) throw new Error(`MAKER_STALE_INPUT: ${change.path} changed during planning; review a fresh plan`);
  return { maker, templateVersion: 1, owner, entity, folder, preset, plan, checks: [
    { command: 'node', args: ['node_modules/vue-tsc/bin/vue-tsc.js', '--noEmit'] },
    { command: 'node', args: ['node_modules/vitest/vitest.mjs', 'run', generated.test] },
    { command: 'node', args: ['scripts/makers/entities.mjs', '--check'] }, { command: 'npm', args: ['run', 'verify'] },
  ] };
}
