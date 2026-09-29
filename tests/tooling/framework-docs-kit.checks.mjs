import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, realpath } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { assembleKit, installedCompiler } from '../../scripts/framework/kit.ts';
import { verifyKit } from '../../scripts/framework/kit-integrity.ts';
import { projectFixture } from '../fixtures/application-docs/fixture.mjs';
import { reviewedExamplesRemoved } from './example-sources-fixture.mjs';
import { projectFiles } from '../../scripts/companion/compiler/project-files.ts';
import { projectModel } from '../../scripts/companion/compiler/model.ts';
import { rebaseMarkdown } from '../../scripts/companion/compiler/framework-docs.ts';
import { digest } from '../../scripts/application-docs/adapters/filesystem.ts';
const root = fileURLToPath(new URL('../../', import.meta.url));
test('packaged CLI ships the pinned parser and supports docs import then existing generation without root dependencies', { timeout: 300000 }, async t => {
  if (await reviewedExamplesRemoved(root)) { t.skip('Kit packaging requires the reviewed framework sources, not an example-removed consumer.'); return; }
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'docs-kit-'))); t.after(() => rm(dir, { recursive: true, force: true }));
  const files = await assembleKit({ root, frameworkRoot: root }, await installedCompiler());
  for (const file of files) { await mkdir(dirname(join(dir, file.path)), { recursive: true }); await writeFile(join(dir, file.path), file.bytes); }
  assert.ok(files.some(file => file.path === '.framework/compiled/node_modules/yaml/dist/index.js'));
  assert.ok(files.some(file => file.path === '.framework/compiled/node_modules/yaml/LICENSE'));
  assert.equal(JSON.parse(await readFile(join(dir,'.framework/compiled/node_modules/yaml/package.json'),'utf8')).version,'2.9.1');
  assert.equal(await readFile(join(dir, '.framework/template/DESIGN-CONSTRAINTS.md'), 'utf8'), await readFile(join(root, 'DESIGN-CONSTRAINTS.md'), 'utf8'));
  await verifyKit(dir); assert.equal((await readdir(dir)).includes('node_modules'),false);
  const run = args => { const result=spawnSync(process.execPath,[join(dir,'shell.mjs'),...args,'--json','--no-interaction'],{cwd:dir,encoding:'utf8',timeout:120000,maxBuffer:8000000});assert.equal(result.status,0,result.stdout+result.stderr);return JSON.parse(result.stdout); };
  assert.ok(run(['docs','schema']).data.types.includes('interaction'));
  await writeFile(join(dir,'input.json'),JSON.stringify(projectFixture().project));
  assert.equal(run(['setup','--input','input.json','--yes']).status,'applied');
  assert.equal(run(['docs','export','--yes']).status,'applied');
  const index=JSON.parse(await readFile(join(dir,'design/docs-index.json'),'utf8')), entry=Object.values(index.entries).find(item=>item.baseline.type==='page');
  const path=join(dir,entry.path), source=await readFile(path,'utf8'); await writeFile(path,source.replace('title: '+entry.baseline.title,'title: Updated from Markdown'));
  assert.equal(run(['docs','import',entry.path,'--yes']).status,'applied');
  const receipt=JSON.parse(await readFile(join(dir,'.framework/intake.json'),'utf8'));
  assert.equal(receipt.files['design/project.json'],digest(await readFile(join(dir,'design/project.json'))));
  assert.equal(run(['generate','--dry-run']).status,'planned','the existing compiler must accept the updated ownership receipt');
  assert.equal(run(['docs','export','--yes']).status,'applied');
  assert.equal(run(['docs','export','--yes']).status,'unchanged');
  assert.equal((await readdir(dir)).includes('node_modules'),false);
});

test('generated consumers retain framework design constraints and rebase product-documentation links', async () => {
  const entries = await projectFiles(root, projectModel(projectFixture().project));
  const files = new Map(entries.map(entry => [entry.path, entry]));
  const path = 'docs/framework/DESIGN-CONSTRAINTS.md';
  const source = await readFile(join(root, 'DESIGN-CONSTRAINTS.md'), 'utf8');
  assert.ok(!files.has('DESIGN-CONSTRAINTS.md'), 'Framework policy must not become a consumer-owned root policy.');
  assert.equal(files.get(path)?.ownership, 'framework');
  assert.equal(files.get(path)?.content, rebaseMarkdown(source, 'DESIGN-CONSTRAINTS.md', path));
  assert.match(files.get('docs/product/README.md')?.content ?? '', /\(\.\.\/framework\/DESIGN-CONSTRAINTS\.md\)/);
  assert.match(files.get(path).content, /\[Product vision\]\(\.\.\/product\/PRODUCT-VISION\.md\)/);
  assert.match(files.get(path).content, /\[Repository instructions\]\(AGENTS\.md\)/);
});
