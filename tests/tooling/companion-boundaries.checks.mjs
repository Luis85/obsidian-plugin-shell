import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, mkdir, rm } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

// Use the repository's real zone contract and pinned analyzer. No exclusions,
// suppressions or production threshold changes are needed for concept sources.
async function probe(sources, transform = value => value) {
  const root = await mkdtemp(join(tmpdir(), 'companion-boundary-'));
  try {
    const config = JSON.parse(await readFile('.fallowrc.json', 'utf8'));
    const boundaries = transform(structuredClone(config.boundaries));
    await writeFile(join(root, '.fallowrc.json'), JSON.stringify({ entry: Object.keys(sources), boundaries }));
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'companion-boundary-fixture', type: 'module' }));
    for (const [path, source] of Object.entries(sources)) {
      const target = join(root, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, source);
    }
    const run = spawnSync(process.execPath, [resolve('node_modules/fallow/bin/fallow'), '--format', 'json', 'dead-code', '--boundary-violations'], {
      cwd: root, encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env, FALLOW_TELEMETRY_DISABLED: '1', GIT_CEILING_DIRECTORIES: root },
    });
    assert.ifError(run.error);
    const report = JSON.parse(run.stdout);
    assert.equal(report.kind, 'dead-code');
    assert.equal(report.schema_version, 9);
    return { status: run.status, summary: report.summary, diagnostic: run.stdout + run.stderr };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('[CONCEPT-ZONE] maintained concept code has a covered isolated zone', async () => {
  const result = await probe({ 'docs/concepts/companion/src/entry.js': 'console.log("concept");\n' });
  assert.equal(result.status, 0, result.diagnostic);
  assert.equal(result.summary.boundary_coverage_violations, 0);
  const broken = await probe({ 'docs/concepts/companion/src/entry.js': 'console.log("concept");\n' }, boundaries => {
    boundaries.zones = boundaries.zones.filter(zone => zone.name !== 'companion-concept');
    boundaries.rules = boundaries.rules.filter(rule => rule.from !== 'companion-concept');
    return boundaries;
  });
  assert.notEqual(broken.status, 0, broken.diagnostic);
  assert.ok(broken.summary.boundary_coverage_violations > 0, broken.diagnostic);
});

test('[CONCEPT-INBOUND] production cannot import concept implementation', async () => {
  const result = await probe({
    'src/domain/probe.ts': 'import { value } from "../../docs/concepts/companion/src/entry.js"; console.log(value);\n',
    'docs/concepts/companion/src/entry.js': 'export const value = 1;\n',
  });
  assert.notEqual(result.status, 0, result.diagnostic);
  assert.ok(result.summary.boundary_violations > 0, result.diagnostic);
});

test('[CONCEPT-OUTBOUND] concept implementation cannot become a runtime adapter', async () => {
  const result = await probe({
    'docs/concepts/companion/src/entry.js': 'import { value } from "../../../../src/domain/probe.ts"; console.log(value);\n',
    'src/domain/probe.ts': 'export const value = 1;\n',
  });
  assert.notEqual(result.status, 0, result.diagnostic);
  assert.ok(result.summary.boundary_violations > 0, result.diagnostic);
});
