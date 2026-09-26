import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, mkdir, rm } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

// Use the repository's real zone contract and pinned analyzer. No exclusions,
// suppressions or production threshold changes are needed for concept sources.
async function probe(sources, transform = value => value, { full = false, entry = Object.keys(sources) } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'companion-boundary-'));
  try {
    const config = JSON.parse(await readFile('.fallowrc.json', 'utf8'));
    const boundaries = transform(structuredClone(config.boundaries));
    await writeFile(join(root, '.fallowrc.json'), JSON.stringify({ entry, boundaries }));
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'companion-boundary-fixture', type: 'module' }));
    for (const [path, source] of Object.entries(sources)) {
      const target = join(root, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, source);
    }
    const run = spawnSync(process.execPath, [resolve('node_modules/fallow/bin/fallow'), '--format', 'json', 'dead-code', ...(full ? [] : ['--boundary-violations'])], {
      cwd: root, encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env, FALLOW_TELEMETRY_DISABLED: '1', GIT_CEILING_DIRECTORIES: root },
    });
    assert.ifError(run.error);
    const report = JSON.parse(run.stdout);
    assert.equal(report.kind, 'dead-code');
    assert.equal(report.schema_version, 9);
    return { status: run.status, summary: report.summary, unusedFiles: report.unused_files, diagnostic: run.stdout + run.stderr };
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


test('[CONCEPT-ASSETS] full analyzer recognizes exact retained JS/CSS and still rejects extra files', async () => {
  const config = JSON.parse(await readFile('.fallowrc.json', 'utf8'));
  const entry = config.entry.filter(path => path.startsWith('docs/concepts/companion/'));
  const sources = Object.fromEntries(await Promise.all(entry.map(async path => [path, await readFile(path, 'utf8')])));
  assert.equal(entry.length, 140, 'Exact authored, vendor and test-kit assembly inventory');
  assert.ok(entry.includes('docs/concepts/companion/src/project-handoff.js'), 'Companion terminal/agent handoff must remain inventoried');
  assert.ok(config.entry.includes('scripts/companion/project-contract.mjs'), 'Shared project contract must remain an analyzer entry');
  assert.ok(config.entry.includes('scripts/companion/storymap-contract.mjs'), 'Shared storymap validator must remain an analyzer entry');
  assert.ok(config.entry.includes('scripts/companion/detail-contract.mjs'), 'Shared detail contract stays analyzed');
  assert.ok(entry.includes('docs/concepts/companion/src/style-guide-frontend.js'), 'Concurrent Design System frontend must remain inventoried');
  const valid = await probe(sources, value => value, { full: true, entry });
  assert.equal(valid.status, 0, valid.diagnostic);
  assert.equal(valid.summary.total_issues, 0, valid.diagnostic);
  const orphan = 'docs/concepts/companion/src/unassembled.css';
  const invalid = await probe({ ...sources, [orphan]: '.unassembled-fixture { display: block; }\n' }, value => value, { full: true, entry });
  assert.notEqual(invalid.status, 0, invalid.diagnostic);
  assert.ok(invalid.unusedFiles.some(file => file.path === orphan), invalid.diagnostic);
});
