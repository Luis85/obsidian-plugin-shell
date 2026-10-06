import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { readForm } from '../../src/cli/domain/form.ts';
import { formValueIssues } from '../../src/cli/domain/form-values.ts';

const features = resolve(import.meta.dirname, '../../src/features');
// Test-owned copy of the showcase example: these checks must survive `examples:remove`.
const fixture = resolve(import.meta.dirname, '../fixtures/forms/feature-brief.json');
/** Runtime form definitions live beside their feature: src/features/<feature>/forms/*.json. */
async function runtimeForms(root = features) {
  const found = [];
  for (const feature of await readdir(root, { withFileTypes: true })) {
    if (!feature.isDirectory()) continue;
    const folder = join(root, feature.name, 'forms');
    const files = await readdir(folder).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
    for (const file of files.filter(name => name.endsWith('.json'))) found.push({ file: `${feature.name}/forms/${file}`, value: JSON.parse(await readFile(join(folder, file), 'utf8')) });
  }
  return found;
}

test('plugin runtime form definitions stay valid in the shared CLI form format', async () => {
  // Prove discovery itself on an isolated feature tree so an empty real tree is not a vacuous pass.
  const probe = await mkdtemp(join(tmpdir(), 'runtime-forms-'));
  try {
    await mkdir(join(probe, 'probe/forms'), { recursive: true });
    await writeFile(join(probe, 'probe/forms/feature-brief.json'), await readFile(fixture));
    await writeFile(join(probe, 'probe/forms/notes.txt'), 'ignored');
    assert.deepEqual((await runtimeForms(probe)).map(item => item.file), ['probe/forms/feature-brief.json']);
  } finally { await rm(probe, { recursive: true, force: true }); }
  for (const { file, value } of await runtimeForms()) {
    const form = readForm(structuredClone(value));
    assert.equal(`${form.id}.json`, file.split('/').at(-1), `${file} is named after its id`);
  }
});

test('the CLI agrees with the runtime about a complete example value', async () => {
  const form = readForm(JSON.parse(await readFile(fixture, 'utf8')));
  const value = { name: 'Weekly review', summary: 'Plan the week.', priority: 'high', estimate: 4, surfaces: ['view'], review: true, reviewers: ['Ada'], links: { issue: '#42', design: '' } };
  assert.deepEqual(formValueIssues(form, value, () => undefined), []);
  assert.deepEqual(formValueIssues(form, { ...value, estimate: 0, surfaces: ['other'] }, () => undefined).map(issue => issue.field), ['estimate', 'surfaces']);
});
