/** Bridge shell branch-protection names to the actual CI of changed standalone projects. */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

export function requiredProjects(paths) {
  return [...new Set(paths.map(path => /^projects\/([a-z][a-z0-9-]*)\//.exec(path)?.[1]).filter(Boolean))].sort();
}

/** Use the newest run of this exact head. A previous green run cannot mask a failed rerun. */
export function projectCheckState(runs, sha) {
  const latest = runs.filter(run => run.head_sha === sha && run.event === 'pull_request')
    .sort((a, b) => b.id - a.id)[0];
  if (!latest || latest.status !== 'completed') return 'pending';
  return latest.conclusion === 'success' ? 'passed' : 'failed';
}

async function main() {
  const { BASE_SHA, HEAD_SHA, GITHUB_REPOSITORY, GITHUB_TOKEN } = process.env;
  if (![BASE_SHA, HEAD_SHA].every(sha => /^[a-f0-9]{40}$/.test(sha ?? '')) || !/^[\w.-]+\/[\w.-]+$/.test(GITHUB_REPOSITORY ?? '') || !GITHUB_TOKEN) {
    throw new Error('PROJECT_CI_CONTEXT: expected exact commit SHAs, repository and read-only token');
  }
  const changed = execFileSync('git', ['diff', '--name-only', '-z', `${BASE_SHA}...${HEAD_SHA}`], { encoding: 'utf8' }).split('\0').filter(Boolean);
  if (!changed.length || changed.some(path => !path.startsWith('projects/'))) throw new Error('PROJECT_CI_SCOPE: expected a projects-only change');
  const projects = requiredProjects(changed);
  for (const name of projects) {
    if (!existsSync(`.github/workflows/projects--${name}--ci.yml`)) throw new Error(`PROJECT_CI_MISSING: ${name} has no synced CI workflow`);
  }
  const deadline = Date.now() + 20 * 60_000;
  while (true) {
    const pending = [];
    for (const name of projects) {
      const workflow = `projects--${name}--ci.yml`;
      const url = `https://api.github.com/repos/${GITHUB_REPOSITORY}/actions/workflows/${workflow}/runs?event=pull_request&head_sha=${HEAD_SHA}&per_page=100`;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`PROJECT_CI_API: ${workflow}: HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.workflow_runs)) throw new Error('PROJECT_CI_API: missing workflow runs');
      const state = projectCheckState(data.workflow_runs, HEAD_SHA);
      if (state === 'failed') throw new Error(`PROJECT_CI_FAILED: ${workflow} did not succeed for ${HEAD_SHA}`);
      if (state === 'pending') pending.push(name);
    }
    if (!pending.length) { console.log(`Project CI passed for ${HEAD_SHA}: ${projects.join(', ') || 'project index only'}`); return; }
    if (Date.now() >= deadline) throw new Error(`PROJECT_CI_TIMEOUT: ${pending.join(', ')}`);
    console.log(`Waiting for project CI: ${pending.join(', ')}`);
    await delay(15_000);
  }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { await main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
