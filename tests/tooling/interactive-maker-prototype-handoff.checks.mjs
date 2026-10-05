// Every agent skill, helper script and npm script that a prepared package's handoff text names must exist in that package.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, realpath, rm, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { loadGuide, prototypePlan } from '../../bin/adapters/prototype.ts';
import { projectGuide, projectPlan, projectStarters } from '../../bin/adapters/projects.ts';
import { applyPrepared } from '../../bin/adapters/storage.ts';
const frameworkRoot = resolve(import.meta.dirname, '../..');
const answers = { title: 'Reading log', pages: ['Overview', 'Details'], components: ['Book card'], approved: true };
const handoffFiles = ['execution-prompt.md', 'README.md'];
/** Skill folders/files and runnable helper scripts; `source/`-prefixed names start at the package root, others at source/. */
const namedPath = /(?:source\/)?(?:\.claude|\.agents)\/skills\/[\w.-]*\w(?:\/[\w.-]*\w)*|(?:source\/)?(?:scripts|bin)\/[\w.-]+(?:\/[\w.-]+)*\.(?:mjs|cjs|js|ts|py)\b/g;

async function scratch(fn) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'maker-handoff-'));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}
async function exists(path) {
  try { await stat(path); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
/** Named paths, resolved inside the applied package, that do not exist there. */
async function missingPaths(packageRoot) {
  const missing = [], named = [];
  for (const file of handoffFiles) {
    const text = await readFile(join(packageRoot, file), 'utf8');
    for (const [path] of text.matchAll(namedPath)) {
      const target = path.startsWith('source/') ? join(packageRoot, path) : join(packageRoot, 'source', path);
      named.push(file + ': ' + path);
      if (!await exists(target)) missing.push(file + ': ' + path);
    }
  }
  return { missing, named };
}
/** `npm run <script>` invocations named by the handoff that the generated source/package.json does not define. */
async function missingScripts(packageRoot) {
  const scripts = JSON.parse(await readFile(join(packageRoot, 'source/package.json'), 'utf8')).scripts;
  const missing = [];
  for (const file of handoffFiles) {
    const text = await readFile(join(packageRoot, file), 'utf8');
    for (const [, name] of text.matchAll(/\bnpm run ([\w:.-]+)/g)) if (!Object.hasOwn(scripts, name)) missing.push(file + ': ' + name);
  }
  return missing;
}

test('a prepared clickdummy package contains every skill, script and npm script its prompt and README name', { timeout: 180000 }, async () => {
  await scratch(async root => {
    const guide = await loadGuide();
    const input = { schemaVersion: 1, guideId: guide.id, guideVersion: guide.version, answers };
    const plan = await prototypePlan({ root, frameworkRoot, out: 'prototypes/reading-log', guide, input, baseline: null });
    await applyPrepared(plan, plan.planHash);
    const packageRoot = join(root, 'prototypes/reading-log');
    const { missing, named } = await missingPaths(packageRoot);
    assert.deepEqual(missing, []);
    // The README's build command must name the offline builder that actually ships, so the check above is not vacuous.
    assert.ok(named.some(entry => entry.startsWith('README.md: ') && entry.endsWith('/build-worker.mjs')), named.join('\n'));
    assert.deepEqual(await missingScripts(packageRoot), []);
  });
});

test('a prepared project-starter package contains every skill and script its prompt and README name', async () => {
  await scratch(async root => {
    const selection = (await projectStarters(frameworkRoot)).find(item => item.id === 'plugin-nuxtui').selection;
    const guide = await projectGuide(selection);
    const input = { schemaVersion: 2, starter: 'plugin-nuxtui', interview: { schemaVersion: 1, guideId: guide.id, guideVersion: guide.version, answers } };
    const plan = await projectPlan({ root, frameworkRoot, out: 'projects/reading-log', input });
    await applyPrepared(plan, plan.planHash);
    const { missing, named } = await missingPaths(join(root, 'projects/reading-log'));
    assert.deepEqual(missing, []);
    assert.ok(named.some(entry => entry.endsWith('scripts/build.mjs')), named.join('\n'));
  });
});
