import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatGenerated, checkGenerated } from '../../scripts/quality/format-generated.mjs';

test('generated-code formatter detects defects, is idempotent and preserves exact Markdown fixtures', async () => {
  const entries = [
    { path: 'src/features/sample.ts', content: 'export const values={a:1,b:"two"}\n' },
    { path: 'src/presentation/components/Sample.vue', content: '<script setup lang="ts">const x=1</script><template><p>{{x}}</p></template>' },
    { path: 'src/styles/sample.css', content: '.sample{color:red}' },
    { path: 'src/locales/sample.json', content: '{"a":"b"}' },
    { path: '.github/workflows/sample.yml', content: 'name: example\non: [push]\n' },
    { path: 'tests/fixtures/exact.md', content: '# Untouched\n\n    exact  spaces\n' },
  ];
  assert.ok((await checkGenerated(entries)).includes(entries[0].path));
  const formatted = await formatGenerated(entries);
  assert.deepEqual(await checkGenerated(formatted), []);
  assert.deepEqual(await formatGenerated(formatted), formatted);
  assert.equal(formatted.at(-1).content, entries.at(-1).content);
  assert.notEqual(formatted[0].content, entries[0].content);
});
