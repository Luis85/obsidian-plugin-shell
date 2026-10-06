import { mkdtemp, rm } from 'node:fs/promises';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sha256 } from '../tooling/release/candidate.mjs';

export const repository = 'Example/plugin';
export const version = '0.5.0';
export const head = 'a'.repeat(40); const base = 'b'.repeat(40); export const other = 'c'.repeat(40);
export const notes = '### Added\n\n- Release automation.';
export const changelog = `# Changelog\n\n## [Unreleased]\n\n## [0.5.0] - 2026-10-01\n\n${notes}\n\n## [0.4.0] - 2026-09-23\n\nPrevious.\n\n` +
  '[Unreleased]: https://github.com/Example/plugin/compare/0.5.0...HEAD\n[0.5.0]: https://github.com/Example/plugin/releases/tag/0.5.0\n[0.4.0]: https://github.com/Example/plugin/releases/tag/0.4.0\n';

/** Retained-candidate bytes exactly as release:rehearse lays them out under reports/release/<version>-<sha>/. */
export function candidateFiles(commit = head) {
  const manifest = { id: 'example-plugin', version, minAppVersion: '1.13.7', isDesktopOnly: true };
  const bytes = { 'main.js': '/* license */ console.log("release");', 'manifest.json': JSON.stringify(manifest), 'styles.css': '.owned { color: inherit; }', 'release-notes.md': `${notes}\n` };
  const assetHashes = Object.fromEntries(['main.js', 'manifest.json', 'styles.css'].map(name => [name, sha256(bytes[name])]));
  const record = { schemaVersion: 1, kind: 'release-rehearsal', sourceCommit: commit, version, identity: manifest.id, minAppVersion: manifest.minAppVersion,
    isDesktopOnly: true, assetHashes, notesHash: sha256(bytes['release-notes.md']), lockHash: 'd'.repeat(64), createdAt: '2026-10-01T10:00:00Z',
    tools: { node: 'v24.21.0', npm: '11.19.1' }, dependencyPins: { schemaVersion: 1, policy: 'exact-npm-pins-v1', lockfile: { hash: 'd'.repeat(64) }, manifests: [{ path: 'package.json', hash: 'e'.repeat(64) }] },
    qualification: { status: 'passed', command: 'verify', sourceCommit: commit, assetHashes, node: 'v24.21.0', npm: '11.19.1' },
    nativeAcceptance: { status: 'not-run' }, publication: 'not-authorized' };
  bytes['candidate.json'] = JSON.stringify(record);
  return { bytes, assetHashes, prefix: `reports/release/${version}-${commit}` };
}

const pr = () => ({ number: 12, state: 'open', draft: true, merged_at: null, html_url: 'https://github.com/Example/plugin/pull/12',
  head: { ref: `release/${version}`, sha: head, repo: { full_name: repository } }, base: { ref: 'main' } });

/** A stateful fake of the gh routes publish uses. `fail` maps "METHOD route" to one injected failure. */
export async function publishFixture(t) {
  const folder = await mkdtemp(join(tmpdir(), 'release-publish-test-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const files = candidateFiles();
  const state = {
    repo: { full_name: repository, default_branch: 'main', permissions: { push: true } },
    pulls: [pr()], refs: { [`heads/release/${version}`]: head, 'heads/main': base }, onMain: new Set([base]),
    checkRuns: [{ id: 5, name: 'Release result', status: 'completed', conclusion: 'success', check_suite: { id: 300 } }],
    runs: [{ id: 900, head_sha: head, conclusion: 'success', check_suite_id: 300 }],
    artifacts: [{ id: 1, name: 'qualified-candidate', expired: false }],
    artifactFiles: { [`${files.prefix}`]: files.bytes, 'dist': { 'main.js': files.bytes['main.js'] } },
    changelog, releases: [], nextId: 100, fail: {}, writes: [], calls: [],
  };
  const json = value => ({ status: 0, stdout: value === undefined ? '' : JSON.stringify(value), stderr: '' });
  const missing = { status: 1, stdout: '', stderr: 'gh: Not Found (HTTP 404)\n' };
  const page = (items, query) => Number(new URLSearchParams(query).get('page') ?? 1) > 1 ? [] : items;
  const releaseRow = item => ({ id: item.id, tag_name: item.tag, draft: item.draft, prerelease: false, target_commitish: item.target, body: item.body });
  function route(method, path, query, input) {
    let match;
    if (method === 'GET' && path === '') return json(state.repo);
    if (method === 'GET' && path === '/pulls') return json(page(state.pulls, query));
    if ((match = /^\/pulls\/(\d+)$/.exec(path)) && method === 'GET') return json(state.pulls.find(item => item.number === Number(match[1])));
    if ((match = /^\/pulls\/(\d+)\/merge$/.exec(path)) && method === 'PUT') {
      const item = state.pulls.find(entry => entry.number === Number(match[1]));
      if (item.head.sha !== input.sha || item.draft || item.state !== 'open') return { status: 1, stdout: '', stderr: 'gh: Head branch was modified (HTTP 409)\n' };
      Object.assign(item, { state: 'closed', merged_at: '2026-10-02T10:00:00Z' }); state.onMain.add(item.head.sha); state.refs['heads/main'] = 'f'.repeat(40);
      return json({ merged: true, sha: 'f'.repeat(40) });
    }
    if ((match = /^\/git\/ref\/(.+)$/.exec(path)) && method === 'GET') return state.refs[match[1]] ? json({ ref: `refs/${match[1]}`, object: { type: 'commit', sha: state.refs[match[1]] } }) : missing;
    if (path === '/git/refs' && method === 'POST') {
      const key = input.ref.slice(5);
      if (state.refs[key]) return { status: 1, stdout: '', stderr: 'gh: Reference already exists (HTTP 422)\n' };
      state.refs[key] = input.sha; return json({ ref: input.ref, object: { type: 'commit', sha: input.sha } });
    }
    if ((match = /^\/git\/refs\/(.+)$/.exec(path)) && method === 'DELETE') { delete state.refs[match[1]]; return json(); }
    if ((match = /^\/commits\/([a-f0-9]{40})\/check-runs$/.exec(path))) return json({ check_runs: page(match[1] === head ? state.checkRuns : [], query) });
    if (path === '/actions/workflows/release.yml/runs') return json({ workflow_runs: page(state.runs, query) });
    if ((match = /^\/actions\/runs\/(\d+)\/artifacts$/.exec(path))) return json({ artifacts: page(Number(match[1]) === 900 ? state.artifacts : [], query) });
    if (path === '/contents/CHANGELOG.md') return json({ encoding: 'base64', content: Buffer.from(state.changelog).toString('base64') });
    if ((match = /^\/compare\/([a-f0-9]{40})\.\.\.main$/.exec(path))) return json(state.onMain.has(match[1]) ? { status: 'ahead', merge_base_commit: { sha: match[1] } } : { status: 'diverged', merge_base_commit: { sha: base } });
    if (path === '/releases' && method === 'GET') return json(page(state.releases.map(releaseRow), query));
    if (path === '/releases' && method === 'POST') {
      const item = { id: state.nextId++, tag: input.tag_name, draft: input.draft, target: input.target_commitish, body: input.body, assets: [] };
      state.releases.push(item); return json(releaseRow(item));
    }
    if ((match = /^\/releases\/(\d+)\/assets$/.exec(path))) return json(page(state.releases.find(item => item.id === Number(match[1])).assets, query));
    if ((match = /^\/releases\/(\d+)$/.exec(path)) && method === 'PATCH') {
      const item = state.releases.find(entry => entry.id === Number(match[1])); item.draft = input.draft; return json(releaseRow(item));
    }
    throw new Error(`Unexpected gh route ${method} ${path}`);
  }
  function upload(url, file) {
    const [, id, name] = /\/releases\/(\d+)\/assets\?name=(.+)$/.exec(url);
    const bytes = readFileSync(file);
    const asset = { id: 500 + Number(id) + state.writes.length, name, state: 'uploaded', size: bytes.length, digest: `sha256:${sha256(bytes)}` };
    state.releases.find(item => item.id === Number(id)).assets.push(asset); return json(asset);
  }
  function download(args) {
    const directory = args[args.indexOf('--dir') + 1];
    for (const [prefix, entries] of Object.entries(state.artifactFiles)) {
      mkdirSync(join(directory, prefix), { recursive: true });
      for (const [name, value] of Object.entries(entries)) writeFileSync(join(directory, prefix, name), value);
    }
    return json();
  }
  function handle(args, options) {
    if (args[0] === 'pr' && args[1] === 'ready') { state.pulls.find(item => item.number === Number(args[2])).draft = false; return json(); }
    if (args[0] === 'run' && args[1] === 'download') return download(args);
    const method = args[args.indexOf('--method') + 1]; const target = args.at(-1);
    if (target.startsWith('https://uploads.github.com/')) return upload(target, args[args.indexOf('--input') + 1]);
    const [path, query = ''] = target.slice(`repos/${repository}`.length).split('?');
    return route(method, path, query, options?.input ? JSON.parse(options.input) : undefined);
  }
  const keyOf = args => {
    if (args[0] !== 'api') return `${args[0]} ${args[1]}`;
    const target = args.at(-1);
    return `${args[args.indexOf('--method') + 1]} ${target.startsWith('https://') ? 'upload' : target.slice(`repos/${repository}`.length).split('?')[0]}`;
  };
  /** Synchronous like spawnSync. */
  const run = (command, args, options) => {
    if (command !== 'gh') throw new Error(`Unexpected command ${command}`);
    const key = keyOf(args); state.calls.push(key);
    if (!key.startsWith('GET ') && key !== 'run download') state.writes.push(key);
    const injected = state.fail[key];
    if (injected) {
      delete state.fail[key];
      if (injected.effect) handle(args, options);
      return { status: injected.status ?? 1, stdout: '', stderr: injected.stderr ?? 'gh: Server Error (HTTP 502)\n', error: injected.error };
    }
    return handle(args, options);
  };
  return { state, run, folder, files };
}

