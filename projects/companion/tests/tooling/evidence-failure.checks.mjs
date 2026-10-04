import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evidenceFailure } from '../../scripts/testing/evidence-runner.mjs';

const source = { sourceCommit: 'a'.repeat(40) };
const asset = { file: 'dist/main.js', sha256: 'b'.repeat(64), bytes: 20 };

test('native adapter failure retains its primary verdict when there is no adapted candidate result', () => {
  assert.equal(evidenceFailure('EVIDENCE_NATIVE_OWNERSHIP', source, source, [asset], [asset], null, source), 'EVIDENCE_NATIVE_OWNERSHIP');
});

test('execution failure survives simultaneous source and asset integrity failures', () => {
  assert.equal(evidenceFailure('EVIDENCE_TIMEOUT', source, {}, [asset], [], { assets: [{ ...asset, bytes: 21 }] }, source), 'EVIDENCE_TIMEOUT');
});

test('successful adaptation still rejects source, asset and candidate mismatches', () => {
  const result = { assets: [asset], candidateSource: source.sourceCommit };
  assert.equal(evidenceFailure(null, source, source, [asset], [asset], result, source), null);
  assert.equal(evidenceFailure(null, source, {}, [asset], [asset], result, source), 'EVIDENCE_SOURCE_CHANGED');
  assert.equal(evidenceFailure(null, source, source, [asset], [], result, source), 'EVIDENCE_ASSETS_CHANGED');
  assert.equal(evidenceFailure(null, source, source, [asset], [asset], { ...result, assets: [{ ...asset, bytes: 21 }] }, source), 'EVIDENCE_ASSET_MISMATCH');
  assert.equal(evidenceFailure(null, source, source, [asset], [asset], { ...result, candidateSource: 'c'.repeat(40) }, source), 'EVIDENCE_CANDIDATE_SOURCE');
});
