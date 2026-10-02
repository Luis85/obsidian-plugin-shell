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
import { projectFiles } from '../../scripts/compiler/adapters/project-files.ts';
import { projectModel } from '../../scripts/companion/compiler/model.ts';
import { rebaseMarkdown } from '../../scripts/companion/compiler/framework-docs.ts';
import { documentationDigest as digest } from '../../scripts/application-docs/adapters/filesystem.ts';
const root = fileURLToPath(new URL('../../', import.meta.url));
test('packaged CLI ships the pinned parser and supports docs import then existing generation without root dependencies', { timeout: 300000 }, async t => {
  if (await reviewedExamplesRemoved(root)) { t.skip('Kit packaging requires the reviewed framework sources, not an example-removed consumer.'); return; }
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'docs-kit-'))); t.after(() => rm(dir, { recursive: true, force: true }));
  const files = await assembleKit({ root, frameworkRoot: root }, await installedCompiler());
  for (const file of files) { await mkdir(dirname(join(dir, file.path)), { recursive: true }); await writeFile(join(dir, file.path), file.bytes); }
  assert.deepEqual(files.filter(file => file.path.startsWith('.framework/compiled/') && file.path.endsWith('.js')).map(file => file.path), ['bin/app.js']);
  assert.ok(files.some(file => file.path === 'bin/licenses/yaml.LICENSE'));
  assert.ok(!files.some(file => file.path.startsWith('bin/node_modules/')));
  assert.equal(JSON.parse(await readFile(join(root,'node_modules/yaml/package.json'),'utf8')).version,'2.9.1');
  for (const name of ['DESIGN-CONSTRAINTS.md', 'PROJECT-SETUP-HANDOUT.md']) assert.equal(await readFile(join(dir, 'bin/template', name), 'utf8'), await readFile(join(root, name), 'utf8'));
  await verifyKit(dir); assert.equal((await readdir(dir)).includes('node_modules'),false);
  const run = args => { const result=spawnSync(process.execPath,[join(dir,'bin/app'),...args,'--json','--no-interaction'],{cwd:dir,encoding:'utf8',timeout:120000,maxBuffer:8000000});assert.equal(result.status,0,result.stdout+result.stderr);return JSON.parse(result.stdout); };
  assert.ok(run(['docs','schema']).data.types.includes('interaction'));
  await writeFile(join(dir,'input.json'),JSON.stringify(projectFixture().project));
  const catalog = run(['capabilities']).data.commands.map(command => command.id);
  for (const id of ['docs import', 'docs export', 'handout generate', 'handout refresh', 'handout validate', 'handout inspect']) assert.ok(catalog.includes(id), id);
  assert.equal(run(['setup','--input','input.json','--yes']).status,'applied');
  assert.equal(run(['handout','generate','--yes']).status,'unchanged');
  const handoutPath = join(dir, 'PROJECT-SETUP-HANDOUT.md');
  const authoredHandout = await readFile(handoutPath, 'utf8') + '\nProduct trio: retain our authored decisions.\n';
  await writeFile(handoutPath, authoredHandout);
  assert.equal(run(['docs','export','--yes']).status,'applied');
  const index=JSON.parse(await readFile(join(dir,'design/docs-index.json'),'utf8')), entry=Object.values(index.entries).find(item=>item.baseline.type==='page');
  const path=join(dir,entry.path), source=await readFile(path,'utf8'); await writeFile(path,source.replace('title: '+entry.baseline.title,'title: Updated from Markdown'));
  assert.equal(run(['docs','import',entry.path,'--yes']).status,'applied');
  assert.equal(await readFile(handoutPath, 'utf8'), authoredHandout, 'Docs synchronization must not overwrite the human-owned handout.');
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

test('generated handout references and project-setup links remain inside the distributed documentation', async () => {
  const analyzer = JSON.parse(await readFile(join(root, 'configs/quality/fallow.json'), 'utf8'));
  assert.ok(analyzer.entry.includes('scripts/handout.mjs'), 'Analyze the documented standalone executable as an explicit entry, not an ignored file.');
  const entries = await projectFiles(root, projectModel(projectFixture().project));
  const files = new Map(entries.map(entry => [entry.path, entry]));
  const name = 'PROJECT-SETUP-HANDOUT.md', path = 'docs/framework/' + name;
  assert.ok(!files.has(name), 'Do not replace the consumer-owned root handout with a prefilled framework copy.');
  assert.equal(files.get(path)?.ownership, 'framework');
  assert.equal(files.get(path)?.content, rebaseMarkdown(await readFile(join(root, name), 'utf8'), name, path));
  assert.match(files.get('docs/project-setup/HANDOUT.md')?.content ?? '', /\(\.\.\/framework\/PROJECT-SETUP-HANDOUT\.md\)/);
});
