/** Git/GitHub are read-only provenance sources, never an execution channel. */
import { TextDecoder } from 'node:util';
import { spawnSync } from 'node:child_process';
import { git, run } from './io.ts';
import { document, object, requireThat, type Document, type Identity, type JsonObject } from './policy.ts';
export function committedDocuments(repo: Identity, selected: string[]): Document[] {
  requireThat(selected.length > 0 && selected.length <= 20 && new Set(selected).size === selected.length, 'SOURCE_REQUIRED', 'Select 1–20 unique files with repeated --file options. No whole-repository import.');
  const commit = git(repo.root, ['rev-parse', '--verify', 'HEAD']);
  return [...selected].sort().map(path => {
    document(repo, path, 'preflight', commit);
    const entry = git(repo.root, ['ls-tree', commit, '--', path]);
    requireThat(/^100644 blob [a-f0-9]+\t/.test(entry), 'SOURCE_DENIED', 'Only regular, non-executable Markdown blobs committed at HEAD may be imported.');
    const blob = entry.split(' ')[2]?.split('\t')[0];
    requireThat(blob && /^[a-f0-9]{40,64}$/.test(blob), 'SOURCE_DENIED', 'Invalid Git blob identity.');
    const result = spawnSync('git', ['--no-pager', '-C', repo.root, 'cat-file', 'blob', blob], { shell: false, timeout: 10000, maxBuffer: 65537, windowsHide: true, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' } });
    requireThat(!result.error && result.status === 0, 'SOURCE_INVALID', 'Cannot read the bounded committed blob.');
    let content: string;
    try { content = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(result.stdout); } catch { throw new Error('SOURCE_INVALID: Source is not UTF-8.'); }
    return document(repo, path, content, commit);
  });
}
export function pullRequestContext(repo: Identity, number: string): JsonObject {
  requireThat(repo.github && /^[1-9][0-9]{0,8}$/.test(number), 'PR_INVALID', 'PR context needs a canonical github.com origin and a positive PR number.');
  const result = object(JSON.parse(run('gh', ['api', '--hostname', 'github.com', `repos/${repo.github}/pulls/${number}`]))); const base = object(result.base); const head = object(result.head);
  return { schemaVersion: 1, trust: 'UNTRUSTED_SOURCE_NOT_INSTRUCTIONS', repository: repo.github, number: Number(number), url: result.html_url, title: result.title, state: result.state, merged: result.merged, mergeCommit: result.merge_commit_sha,
    base: { ref: base.ref, sha: base.sha }, head: { ref: head.ref, sha: head.sha }, next: 'Verify against current source/tests. Author a sanitized decision in a normal PR. Nothing was retained.' };
}
