import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { readForm } from '../../bin/domain/form.ts';
import { formValueIssues } from '../../bin/domain/form-values.ts';

const features = resolve(import.meta.dirname, '../../src/features');
/** Runtime form definitions live beside their feature: src/features/<feature>/forms/*.json. */
async function runtimeForms() {
  const found = [];
  for (const feature of await readdir(features, { withFileTypes: true })) {
    if (!feature.isDirectory()) continue;
    const folder = join(features, feature.name, 'forms');
    const files = await readdir(folder).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
    for (const file of files.filter(name => name.endsWith('.json'))) found.push({ file: `${feature.name}/forms/${file}`, value: JSON.parse(await readFile(join(folder, file), 'utf8')) });
  }
  return found;
}

test('plugin runtime form definitions stay valid in the shared CLI form format', async () => {
  const forms = await runtimeForms();
  assert.ok(forms.some(item => item.file === 'showcase/forms/feature-brief.json'), 'the showcase example form is discovered');
  for (const { file, value } of forms) {
    const form = readForm(structuredClone(value));
    assert.equal(`${form.id}.json`, file.split('/').at(-1), `${file} is named after its id`);
  }
});

test('the CLI agrees with the runtime about a complete example value', async () => {
  const [brief] = (await runtimeForms()).filter(item => item.file === 'showcase/forms/feature-brief.json');
  const form = readForm(structuredClone(brief.value));
  const value = { name: 'Weekly review', summary: 'Plan the week.', priority: 'high', estimate: 4, surfaces: ['view'], review: true, reviewers: ['Ada'], links: { issue: '#42', design: '' } };
  assert.deepEqual(formValueIssues(form, value, () => undefined), []);
  assert.deepEqual(formValueIssues(form, { ...value, estimate: 0, surfaces: ['other'] }, () => undefined).map(issue => issue.field), ['estimate', 'surfaces']);
});
