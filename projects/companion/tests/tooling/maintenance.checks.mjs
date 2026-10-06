import test from 'node:test';
import assert from 'node:assert/strict';
import { discover, dependencyState, sources } from '../../scripts/maintenance/discovery.mjs';

const now = new Date('2026-09-23T12:00:00Z');
const metadata = (version, published = '2026-09-01T00:00:00Z') => ({ 'dist-tags': { latest: version }, versions: { [version]: { peerDependencies: { vue: '^3' } } }, time: { [version]: published } });
test('stable discovery applies cooldown without disguising peer qualification as support', () => {
  const state = (version, published) => dependencyState({ name: 'sample', selected: '1.0.0', metadata: metadata(version, published), now });
  assert.equal(state('1.0.0').state, 'current');
  assert.equal(state('1.0.1').state, 'update-available');
  assert.equal(state('1.0.1', '2026-09-22T00:00:00Z').state, 'cooling-down');
  assert.equal(state('2.0.0', '2026-09-19T00:00:00Z').state, 'cooling-down');
  assert.equal(state('0.9.0').state, 'blocked');
  assert.deepEqual(state('2.0.0').peers, { vue: '^3' });
  assert.throws(() => state('2.0.0-beta.1'), /INVALID_STABLE_VERSION/);
  assert.throws(() => state('1.0.1', 'invalid'), /INVALID_REGISTRY_METADATA/);
  assert.throws(() => state('1.0.1', '2027-01-01'), /INVALID_REGISTRY_METADATA/);
});
test('freshness reports successful discovery and all failed sources independently', async () => {
  const pkg = { dependencies: { example: '1.0.0' }, devDependencies: { typescript: '6.0.3' } };
  const manifest = { minAppVersion: '1.13.7' };
  const fixtures = { [sources.desktop]: { latestVersion: '1.13.7', beta: { latestVersion: '1.14.2' } },
    [sources.installer]: { tag_name: 'v1.13.7' }, [sources.node]: [{ version: 'v24.21.0', lts: 'Krypton' }, { version: 'v26.1.0', lts: false }],
    [sources.schedule]: { v24: { lts: '2025-10-28', maintenance: '2026-10-20' } },
    'https://registry.npmjs.org/example': metadata('1.0.0'), 'https://registry.npmjs.org/typescript': metadata('6.0.3') };
  const good = await discover({ pkg, manifest, now, fetcher: async url => fixtures[url] });
  assert.equal(good.status, 'reported');
  assert.equal(good.rows.find(row => row.name === 'node-active-lts').candidate, '24.21.0');
  assert.equal(good.rows.find(row => row.name === 'obsidian-public-desktop').earlyAccess, '1.14.2');
  assert.equal(good.rows.find(row => row.name === 'all-category-security').state, 'blocked');
  assert.equal(good.rows.find(row => row.name === 'upstream-eslint-support').state, 'incompatible');
  const failed = await discover({ pkg, manifest, now, fetcher: async () => { throw new Error('NETWORK_UNAVAILABLE'); } });
  assert.equal(failed.status, 'source-unavailable');
  assert.equal(failed.rows.filter(row => row.state === 'source-unavailable').length, 5);
  assert.ok(failed.rows.every(row => row.owner && row.nextReview && row.source && row.checkedAt));
  assert.ok(failed.rows.filter(row => row.state === 'source-unavailable').every(row => row.candidate === null && row.reason === 'NETWORK_UNAVAILABLE'));
});
