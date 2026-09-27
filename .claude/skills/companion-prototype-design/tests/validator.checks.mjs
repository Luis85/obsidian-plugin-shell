// Synthetic CLI fixtures test the helper protocol, NOT the actual shell/compiler.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateProject } from '../scripts/validate-project.mjs';
function fakeCheckout(t, readerBody, plannerBody) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'fake-prototype-cli-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'scripts/companion'), { recursive: true });
  const prelude = `import fs from 'node:fs'; import path from 'node:path';
const a=process.argv.slice(2); const get=k=>a[a.indexOf(k)+1];
if(a.includes('--apply')||a.includes('--yes')) throw new Error('Unexpected write authorization');\n`;
  fs.writeFileSync(path.join(root, 'scripts/companion/generate.mjs'), prelude + (readerBody ??
    `process.stdout.write(fs.readFileSync(get('--input')));`));
  fs.writeFileSync(path.join(root, 'shell.mjs'), prelude + `if(a[0]!=='generate') throw new Error('Missing generate subcommand');\n` + (plannerBody ??
    `process.stdout.write(JSON.stringify({planHash:'test-plan-not-real',conflicts:[]}));`));
  const input = path.join(root, 'input.json');
  fs.writeFileSync(input, ' {"synthetic-fixture":true}\n');
  return { root, input };
}
test('synthetic CLI protocol receives generate subcommand and preserves input bytes', t => {
  const { root, input } = fakeCheckout(t);
  const before = fs.readFileSync(input);
  const report = validateProject(root, input);
  assert.equal(report.status, 'passed-reader-and-plan-only');
  assert.equal(report.checks.length, 2);
  assert.ok(fs.readFileSync(input).equals(before));
  assert.match(report.limitations[0], /No apply/);
});
test('reader nonzero status fails closed before planning', t => {
  const { root, input } = fakeCheckout(t, 'process.exit(3)');
  const report = validateProject(root, input);
  assert.equal(report.status, 'failed');
  assert.equal(report.checks.length, 1);
  assert.equal(report.checks[0].exitCode, 3);
});
test('reader normalization instead of exact byte echo is rejected', t => {
  const { root, input } = fakeCheckout(t, `process.stdout.write(JSON.stringify(JSON.parse(fs.readFileSync(get('--input'),'utf8'))));`);
  const report = validateProject(root, input);
  assert.equal(report.status, 'failed');
  assert.match(report.checks[0].error, /original bytes/);
});
test('generator nonzero status is not promoted to success', t => {
  const { root, input } = fakeCheckout(t, null, 'process.exit(2)');
  const report = validateProject(root, input);
  assert.equal(report.status, 'failed');
  assert.equal(report.checks[1].exitCode, 2);
});
test('generator malformed JSON or missing planHash fails closed', t => {
  for (const text of ['garbage', '{}', 'null', '[]']) {
    const { root, input } = fakeCheckout(t, null, `process.stdout.write(${JSON.stringify(text)});`);
    assert.equal(validateProject(root, input).status, 'failed');
  }
});
test('generator conflicts in a zero-exit plan are rejected', t => {
  const { root, input } = fakeCheckout(t, null, 'process.stdout.write(JSON.stringify({planHash:"x", conflicts:["foreign file"]}));');
  const report = validateProject(root, input);
  assert.equal(report.status, 'failed');
  assert.match(report.checks[1].error, /conflicts/);
});
test('unexpected generation target writes are detected', t => {
  const { root, input } = fakeCheckout(t, null,
    'fs.mkdirSync(path.join(get("--vault"),get("--target"))); process.stdout.write(JSON.stringify({planHash:"x"}));');
  const report = validateProject(root, input);
  assert.equal(report.status, 'failed');
  assert.match(report.checks[1].error, /unexpectedly created/);
});
test('timeout is failed evidence, not an empty successful result', t => {
  const { root, input } = fakeCheckout(t, 'setTimeout(()=>{},10000)');
  const report = validateProject(root, input, 40);
  assert.equal(report.status, 'failed');
  assert.ok(report.checks[0].error);
});
test('missing repository does not create a replacement or fabricate compatibility', t => {
  const { root, input } = fakeCheckout(t);
  fs.unlinkSync(path.join(root, 'shell.mjs'));
  assert.throws(() => validateProject(root, input));
});
