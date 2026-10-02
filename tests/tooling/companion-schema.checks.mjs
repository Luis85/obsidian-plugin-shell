import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { companionProjectSchema } from '../../scripts/companion/schema/project.mjs';
import { validateAuthoringDocument } from '../../scripts/companion/authoring-contract.ts';
import { parseCliArguments } from '../../bin/adapters/framework/catalog.ts';
import { schemaCorpus } from './companion-schema-fixture.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const corpus = schemaCorpus();
const sha = text => createHash('sha256').update(text).digest('hex');
function cli(args, cwd = root, input) {
  const output = spawnSync(process.execPath, ['--experimental-strip-types', join(root, 'bin/app'), ...args, '--json'], {
    cwd, input, encoding: 'utf8', timeout: 30000, maxBuffer: 10_000_000,
  });
  assert.equal(output.error, undefined);
  return { output, result: JSON.parse(output.stdout) };
}

test('published project schema is detached, inert, complete for typed subsystems and distinct from operation schema', () => {
  const schema = companionProjectSchema();
  assert.equal(schema.$id, 'urn:obsidian-plugin-shell:companion-project:6');
  assert.equal(schema.properties.executable.const, false);
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.$defs.visualDesigns.properties.schema.const, 3);
  for (const name of ['visualDesigns', 'storymaps', 'designSystem', 'sitemap', 'features', 'nativeIntegrations'])
    assert.ok(schema.properties.design.properties[name]);
  assert.match(schema['x-validation'].command, /project validate/);
  assert.match(schema['x-validation'].generationCommand, /compiler check/);
  schema.properties.executable.const = true;
  assert.equal(companionProjectSchema().properties.executable.const, false);
});
for (const item of corpus.positive) test('current schema corpus normalizes without losing the source: ' + item.name, () => {
  const before = JSON.stringify(item.document);
  validateAuthoringDocument(item.document);
  assert.equal(item.document.schemaVersion, 6);
  assert.equal(JSON.stringify(item.document), before);
});
for (const item of corpus.negative) test('complete project validator rejects: ' + item.name, () => {
  assert.throws(() => validateAuthoringDocument(item.document));
});
test('schema discovery never reads executable project configuration and help documents exact commands', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'schema-discovery-'));
  try {
    await writeFile(join(scratch, 'shell.config.json'), 'invalid');
    await writeFile(join(scratch, 'package.json'), '{"scripts":{"preinstall":"exit 99"}}');
    const before = await readdir(scratch);
    const { output, result } = cli(['project', 'schema'], scratch);
    assert.equal(output.status, 0, output.stderr);
    assert.deepEqual(result.data, companionProjectSchema());
    assert.deepEqual(await readdir(scratch), before);
    assert.equal(cli(['project', 'schema', '--version', '5'], scratch).result.diagnostics[0].code, 'SCHEMA_VERSION');
    const help = cli(['help', 'project', 'schema'], scratch).result;
    assert.ok(JSON.stringify(help).includes('Published project schema version'));
    assert.equal(parseCliArguments(['project', 'validate', '--input', '-']).command, 'project validate');
  } finally { await rm(scratch, { recursive: true, force: true }); }
});
test('project validate preserves input bytes, reports migration and never leaks content or infers business acceptance', async () => {
  const bytes = await readFile(join(root, 'docs/concepts/companion/companion-project.json'), 'utf8');
  const { output, result } = cli(['project', 'validate', '--input', '-'], root, bytes);
  assert.equal(output.status, 0, output.stderr);
  assert.equal(result.data.inputSha256, sha(bytes));
  assert.equal(result.data.inputVersion, 5);
  assert.equal(result.data.normalizedVersion, 6);
  assert.deepEqual(result.data.written, []);
  assert.equal(result.data.contentIncluded, false);
  assert.equal(result.data.generationReadiness, 'not-inferred');
  assert.equal('document' in result.data, false);
  assert.equal(result.data.counts.surfaces, 28);
  assert.equal(cli(['project', 'validate', '--input', '-'], root, '{invalid').output.status, 1);
});
