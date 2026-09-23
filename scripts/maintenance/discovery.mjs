import { stableVersion, compareVersions } from '../release/prepare.mjs';

export const sources = Object.freeze({
  desktop: 'https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/desktop-releases.json',
  installer: 'https://api.github.com/repos/obsidianmd/obsidian-releases/releases/latest',
  node: 'https://nodejs.org/dist/index.json',
  schedule: 'https://raw.githubusercontent.com/nodejs/Release/main/schedule.json',
});
async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'plugin-template-maintenance', Accept: 'application/json' } });
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  return response.json();
}
export function dependencyState({ name, selected, metadata, now }) {
  stableVersion(selected);
  const candidate = stableVersion(metadata?.['dist-tags']?.latest);
  const entry = metadata.versions?.[candidate];
  const published = metadata.time?.[candidate];
  if (!entry || !Number.isFinite(Date.parse(published)) || Date.parse(published) > now.getTime()) throw new Error('INVALID_REGISTRY_METADATA');
  const change = compareVersions(candidate, selected);
  const days = candidate.split('.')[0] === selected.split('.')[0] ? 3 : 7;
  const eligibleAt = new Date(Date.parse(published) + days * 86400000).toISOString();
  return { name, selected, candidate, published, eligibleAt, peers: entry.peerDependencies ?? {}, engines: entry.engines ?? {},
    state: change < 0 ? 'blocked' : change === 0 ? 'current' : now.getTime() < Date.parse(eligibleAt) ? 'cooling-down' : 'update-available',
    reason: change < 0 ? 'Selected version is ahead of the stable dist-tag; review channel history.' : change === 0 ? 'Matches stable dist-tag; installed graph support is evaluated separately.' : 'Review exact version, peers, runtime, source guards and all gates before adoption.' };
}
export async function discover({ pkg, manifest, now = new Date(), fetcher = fetchJson, actionPins = [], audit = null, nodeSelected = '24.21.0' }) {
  const rows = []; const checkedAt = now.toISOString();
  const base = (name, source, selected) => ({ name, source, selected, checkedAt, owner: 'repository-maintainer', nextReview: new Date(now.getTime() + 7 * 86400000).toISOString() });
  async function check(name, source, selected, inspect) {
    const row = base(name, source, selected);
    try { rows.push({ ...row, ...await inspect(await fetcher(source)) }); }
    catch (error) { rows.push({ ...row, candidate: null, state: 'source-unavailable', reason: String(error.message).slice(0, 250) }); }
  }
  const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
  if (/^npm@\d+\.\d+\.\d+$/.test(pkg.packageManager ?? '')) dependencies.npm = pkg.packageManager.slice(4);
  // Bounded batches avoid making a registry outage a long serial timeout.
  const entries = Object.entries(dependencies).sort(([a], [b]) => a.localeCompare(b));
  for (let index = 0; index < entries.length; index += 5) await Promise.all(entries.slice(index, index + 5).map(([name, selected]) =>
    check(name, `https://registry.npmjs.org/${encodeURIComponent(name)}`, selected, metadata => dependencyState({ name, selected, metadata, now }))));
  await check('obsidian-public-desktop', sources.desktop, manifest.minAppVersion, data => {
    const candidate = stableVersion(data.latestVersion);
    return { candidate, earlyAccess: data.beta?.latestVersion ?? null, state: candidate === manifest.minAppVersion ? 'current' : 'update-available', reason: 'Public desktop only. The selected value is the declared minimum; no automatic floor increase or native qualification.' };
  });
  await check('obsidian-installer', sources.installer, null, data => ({ candidate: stableVersion(data.tag_name?.replace(/^v/, '')), state: 'blocked', reason: 'Installer discovered independently; native platform/runtime qualification is required.' }));
  rows.push({ ...base('obsidian-mobile', 'https://obsidian.md/changelog/', null), candidate: null, state: 'blocked', reason: 'Desktop-only manifest. Mobile app/store and device qualification not provisioned; do not infer mobile from desktop.' });
  await check('node-active-lts', sources.node, nodeSelected, async data => {
    const schedule = await fetcher(sources.schedule);
    const active = Object.entries(schedule).filter(([, item]) => item.lts && Date.parse(item.lts) <= now.getTime() && Date.parse(item.maintenance) > now.getTime()).map(([major]) => major);
    const eligible = data.filter(item => active.includes(item.version.split('.')[0]) && item.lts).sort((a, b) => compareVersions(b.version.slice(1), a.version.slice(1)));
    const candidate = stableVersion(eligible[0]?.version?.slice(1));
    return { candidate, state: candidate === nodeSelected ? 'current' : 'update-available', reason: 'Latest patch in Active LTS schedule; toolchain matrix required before adoption.', scheduleSource: sources.schedule };
  });
  for (const pin of actionPins) await check(`action:${pin.name}`, `https://api.github.com/repos/${pin.name}/releases/latest`, pin.commit, async release => {
    if (typeof release.tag_name !== 'string') throw new Error('INVALID_ACTION_RELEASE');
    const commit = await fetcher(`https://api.github.com/repos/${pin.name}/commits/${encodeURIComponent(release.tag_name)}`);
    if (!/^[a-f0-9]{40}$/.test(commit.sha ?? '')) throw new Error('INVALID_ACTION_COMMIT');
    return { candidate: commit.sha, tag: release.tag_name, state: commit.sha === pin.commit ? 'current' : 'update-available', reason: 'Full action revision compared to current release tag; review before changing pin.' };
  });
  rows.push({ ...base('all-category-security', 'npm audit (separate live check)', null), candidate: null,
    state: audit?.status === 'passed' && Date.parse(audit.capturedAt) <= now.getTime() && now.getTime() - Date.parse(audit.capturedAt) < 86400000 ? 'current' : 'blocked',
    reason: audit ? `Recorded audit: ${audit.status}, captured ${audit.capturedAt}; this discovery did not run an audit.` : 'No recent all-category security record; run npm run check:security.' });
  rows.push({ ...base('upstream-eslint-support', 'docs/development/ITERATION-TWO-DEPENDENCY-EXCEPTION.md', 'nested ESLint 9.39.5'), candidate: null,
    state: 'incompatible', reason: 'Official Obsidian preset SDL/import/React dependencies retain unsupported ESLint-9 peers. A current root version or clean audit does not close this exception.' });
  rows.push({ ...base('typescript-parser-qualification', 'docs/development/ITERATION-TWO-DEPENDENCY-EXCEPTION.md', dependencies.typescript), candidate: null,
    state: 'blocked', reason: 'TypeScript 6.0.3 is the qualified parser choice. Assess newer stable candidates with supported parser peers and negative gates, never force peers.' });
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return { schemaVersion: 1, checkedAt, status: rows.some(row => row.state === 'source-unavailable') ? 'source-unavailable' : 'reported',
    scope: 'discovery-only; not compatibility or release acceptance', rows };
}
