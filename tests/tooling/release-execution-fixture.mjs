import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sha256 } from '../../scripts/release/candidate.mjs';
import { nativeScenarios } from '../../scripts/release/promotion-plan.mjs';

export async function executionFixture(t) {
  const candidateDirectory = await mkdtemp(join(tmpdir(), 'release-execution-test-'));
  t.after(() => rm(candidateDirectory, { recursive: true, force: true }));
  const commit = 'a'.repeat(40); const version = '0.4.0'; const repository = 'Example/consumer-plugin';
  const now = () => new Date('2026-09-23T12:00:00Z');
  const manifest = { id: 'consumer-plugin', version, minAppVersion: '1.13.7', isDesktopOnly: true };
  const bytes = { 'main.js': '/* license */ console.log("retained");', 'manifest.json': JSON.stringify(manifest),
    'styles.css': '.owned { color: inherit; }', 'release-notes.md': '# Notes\n\nReviewed release.' };
  const hashes = Object.fromEntries(Object.entries(bytes).map(([name, value]) => [name, sha256(value)]));
  const assetHashes = Object.fromEntries(['main.js', 'manifest.json', 'styles.css'].map(name => [name, hashes[name]]));
  const record = { schemaVersion: 1, kind: 'release-rehearsal', sourceCommit: commit, version, identity: manifest.id,
    minAppVersion: manifest.minAppVersion, isDesktopOnly: true, assetHashes, notesHash: hashes['release-notes.md'], lockHash: 'b'.repeat(64),
    createdAt: '2026-09-23T10:00:00Z', tools: { node: 'v24.21.0', npm: '11.19.1' },
    qualification: { status: 'passed', command: 'verify', sourceCommit: commit, assetHashes, node: 'v24.21.0', npm: '11.19.1' },
    nativeAcceptance: { status: 'not-run' }, publication: 'not-authorized' };
  bytes['candidate.json'] = JSON.stringify(record); hashes['candidate.json'] = sha256(bytes['candidate.json']);
  for (const [name, value] of Object.entries(bytes)) await writeFile(join(candidateDirectory, name), value);
  const state = { schemaVersion: 1, repository, sourceCommit: commit, sourceReviewed: true, checkedAt: now().toISOString(), tag: null, releases: [] };
  const draft = { id: 11, version, draft: true, targetCommit: commit, assets: Object.entries(hashes).map(([name, hash]) => ({ name, sha256: hash })) };
  const acceptance = [{ schemaVersion: 1, mode: 'manual', actor: 'Fixture maintainer', completedAt: '2026-09-23T11:30:00Z', sourceCommit: commit, version, assetHashes,
    host: { platform: 'linux', architecture: 'x64', appVersion: '1.13.7', installerVersion: '1.13.8' }, scenarios: Object.fromEntries(nativeScenarios.map(name => [name, 'passed'])) }];
  const review = { actor: 'Fixture reviewer', reviewedAt: '2026-09-23T11:40:00Z', sourceCommit: commit, assetHashes };
  const input = { candidateDirectory, commit, version, repository, mode: 'draft', acceptance, review, platforms: ['linux'] };
  const calls = [];
  const remote = {
    async snapshot(request) { calls.push({ method: 'snapshot', ...request }); return structuredClone(state); },
    async createDraft(request) {
      calls.push({ method: 'createDraft', ...request });
      state.releases.push({ id: 11, version: request.version, draft: true, targetCommit: request.commit, assets: [] });
      return { id: 11 };
    },
    async uploadAsset(request) {
      calls.push({ method: 'uploadAsset', ...request });
      state.releases.find(item => item.id === request.releaseId).assets.push({ name: request.name, sha256: sha256(request.bytes) });
    },
    async publishDraft(request) {
      calls.push({ method: 'publishDraft', ...request });
      state.releases.find(item => item.id === request.releaseId).draft = false;
    },
  };
  return { input, bytes, hashes, state, draft, now, remote, calls, options: { remote, now, execute: true, authorize: async binding => structuredClone(binding) } };
}
