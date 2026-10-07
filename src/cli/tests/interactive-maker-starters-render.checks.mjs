const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';
import { resolveValues, interpolate, renderFiles, renderProcesses } from '#shared/companion/starters/render.ts';
import { validateDefinition } from '#shared/companion/starters/validation.ts';
import { fileStarter } from './support/starters-fixture.mjs';

// Starter rendering (render.ts): input resolution, the three placeholder filters, JSON payloads and process arguments.
const definition = validateDefinition(fileStarter());
const refusal = (run, code, message) => assert.throws(run, error => error.code === code && error.message === message);

test('values resolve supplied inputs over defaults and omit absent optional inputs', () => {
  assert.deepEqual(resolveValues(definition, { id: 'demo', name: 'Demo' }), { id: 'demo', name: 'Demo', count: 2, flag: true });
  assert.deepEqual(resolveValues(definition, { id: 'demo', name: 'Demo', count: 3, flag: false, author: 'Ada' }), { id: 'demo', name: 'Demo', count: 3, flag: false, author: 'Ada' });
  refusal(() => resolveValues(definition, { id: 'demo', name: 'Demo', extra: 1 }), 'STARTER_INPUT', 'Unknown input name.');
  refusal(() => resolveValues(definition, { name: 'Demo' }), 'STARTER_INPUT', 'Supply the required input id.');
  refusal(() => resolveValues(definition, { id: 'demo', name: 'Demo', count: 9 }), 'STARTER_INPUT', 'Choose an allowed value for count.');
  refusal(() => resolveValues(definition, []), 'STARTER_INVALID', 'Expected an object.');
});

test('placeholders render plain, JSON and HTML-escaped values and refuse unknown names', () => {
  const values = { name: `<a href="x">Tom & 'Jo'</a>`, count: 2, flag: false };
  assert.equal(interpolate('{{name}}|{{count|json}}|{{flag}}', values), `<a href="x">Tom & 'Jo'</a>|2|false`);
  assert.equal(interpolate('{{name|json}}', values), JSON.stringify(values.name));
  assert.equal(interpolate('{{name|html}}', values), '&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jo&#39;&lt;/a&gt;');
  assert.equal(interpolate('no {{ Placeholder }} here {{x|upper}}', values), 'no {{ Placeholder }} here {{x|upper}}');
  refusal(() => interpolate('{{missing}}', values), 'STARTER_VARIABLE', 'No value for missing.');
});

test('files render content and JSON payloads with every value kind', () => {
  const values = resolveValues(definition, { id: 'demo', name: 'A&B' });
  assert.deepEqual(renderFiles(definition, values), [
    { path: 'demo/README.md', content: '# A&amp;B\ncount=2 flag=true\n' },
    { path: 'package.json', content: '{\n  "name": "demo",\n  "private": true,\n  "scripts": {\n    "hello": "node tools/hello.mjs npm"\n  },\n  "list": [\n    "A&B",\n    1,\n    true,\n    null\n  ]\n}\n' },
    { path: 'tools/hello.mjs', content: definition.files[2].content },
  ]);
});

test('resolved file paths must stay portable and case-insensitively unique', () => {
  const values = { id: 'demo', name: 'Demo', count: 2, flag: true };
  const twice = { ...definition, files: [{ path: 'A/{{id}}.md', content: 'x' }, { path: 'a/{{id}}.md', content: 'y' }] };
  refusal(() => renderFiles(twice, values), 'STARTER_PATH', 'Unsafe or duplicate resolved file path.');
  const escaping = { ...definition, files: [{ path: '{{id}}/x.md', content: 'x' }] };
  refusal(() => renderFiles(escaping, { ...values, id: '..' }), 'STARTER_PATH', 'Unsafe or duplicate resolved file path.');
  refusal(() => renderFiles(escaping, { ...values, id: '.git' }), 'STARTER_PATH', 'Unsafe or duplicate resolved file path.');
});

test('process arguments are interpolated into copies that leave the definition untouched', () => {
  const values = { id: 'demo', name: 'Demo', count: 2, flag: true };
  const rendered = renderProcesses(definition, values);
  assert.deepEqual(rendered, [
    { id: 'hello', label: 'Hello', description: 'Writes hello.', dependsOn: [], steps: [{ runner: 'node', script: 'tools/hello.mjs', args: ['demo'], cwd: '.', timeout: 10000 }] },
    { id: 'again', label: 'Again', description: 'Runs after hello.', dependsOn: ['hello'], steps: [{ runner: 'npm', args: ['run', 'hello'], cwd: '.', timeout: 60000 }] },
  ]);
  rendered[1].dependsOn.push('mutated'); rendered[0].steps[0].args.push('mutated');
  assert.deepEqual(definition.processes[1].dependsOn, ['hello']);
  assert.deepEqual(definition.processes[0].steps[0].args, ['{{id}}']);
});

test('inputs and definition text refuse C0 controls and DEL but keep other characters', () => {
  for (const control of ['\u0000', '\u0007', '\n', '\u001f', '\u007f']) {
    refusal(() => resolveValues(definition, { id: 'demo', name: 'a' + control }), 'STARTER_INPUT', 'Invalid input name.');
    refusal(() => validateDefinition(fileStarter({ summary: 'a' + control })), 'STARTER_INVALID', 'Invalid summary.');
  }
  assert.deepEqual(resolveValues(definition, { id: 'demo', name: 'Caf\u00e9 \u0080 \u{1F600} ~' }).name, 'Caf\u00e9 \u0080 \u{1F600} ~');
  assert.equal(validateDefinition(fileStarter({ summary: 'Tab-free \u00a0 text' })).summary, 'Tab-free \u00a0 text');
});
