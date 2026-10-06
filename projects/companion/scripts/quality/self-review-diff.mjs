/** Diff collection for the self-review guard: only added/removed lines are inspected, never context. */
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MAX_UNTRACKED_BYTES = 1024 * 1024;
const gitOptions = ['-c', 'core.quotepath=false', '-c', 'diff.renames=true'];

function git(root, args) {
  return execFileSync('git', [...gitOptions, ...args], { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
}
function tryGit(root, args) {
  try { return git(root, args).trim(); } catch { return ''; }
}

/** An explicit ref wins; otherwise the merge-base of HEAD with origin/main, then main, then origin/HEAD. */
export function resolveBase(root, explicit) {
  const candidates = explicit ? [explicit] : ['origin/main', 'main', 'origin/HEAD'];
  for (const candidate of candidates) {
    const base = explicit ? tryGit(root, ['rev-parse', '--verify', `${candidate}^{commit}`]) : tryGit(root, ['merge-base', 'HEAD', candidate]);
    if (base) return { ref: candidate, sha: base };
  }
  const wanted = explicit ? `base ref "${explicit}"` : 'a merge-base with origin/main (also tried main, origin/HEAD)';
  throw new Error(`SELF_REVIEW_BASE: cannot resolve ${wanted}. Fetch origin or pass --base <ref>.`);
}

function newFile(path, status) { return { path, oldPath: null, status, added: [], removed: [] }; }
const hunkHeader = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

function readHunk(lines, start, file) {
  const header = hunkHeader.exec(lines[start]);
  let oldLine = Number(header[1]); let newLine = Number(header[3]);
  let oldLeft = header[2] === undefined ? 1 : Number(header[2]);
  let newLeft = header[4] === undefined ? 1 : Number(header[4]);
  let index = start + 1;
  // Hunk line counts decide where the hunk ends, so a content line that looks like a
  // "+++" header can never be mistaken for one.
  while (index < lines.length && (oldLeft > 0 || newLeft > 0 || lines[index].startsWith('\\'))) {
    const text = lines[index]; const marker = text[0];
    if (marker === '+') { file.added.push({ line: newLine++, text: text.slice(1) }); newLeft--; }
    else if (marker === '-') { file.removed.push({ line: oldLine++, text: text.slice(1) }); oldLeft--; }
    else if (marker === ' ') { oldLine++; newLine++; oldLeft--; newLeft--; }
    index++;
  }
  return index;
}
function headerPath(line, prefix) {
  const raw = line.slice(4).split('\t')[0];
  return raw === '/dev/null' ? null : raw.replace(new RegExp(`^${prefix}/`), '');
}
function readFileHeader(lines, start) {
  let file = newFile('', 'M'); let index = start + 1;
  for (; index < lines.length && !lines[index].startsWith('@@') && !lines[index].startsWith('diff --git '); index++) {
    const line = lines[index];
    if (line.startsWith('new file mode')) file.status = 'A';
    else if (line.startsWith('deleted file mode')) file.status = 'D';
    else if (line.startsWith('rename from ')) { file.status = 'R'; file.oldPath = line.slice(12); }
    else if (line.startsWith('rename to ')) file.path = line.slice(10);
    else if (line.startsWith('Binary files') || line.startsWith('GIT binary patch')) file.binary = true;
    else if (line.startsWith('--- ') && file.status === 'D') file.path = headerPath(line, 'a') ?? file.path;
    else if (line.startsWith('+++ ')) file.path = headerPath(line, 'b') ?? file.path;
  }
  if (!file.path) file.path = /^diff --git a\/(.+) b\/\1$/.exec(lines[start])?.[1] ?? '';
  return { file, index };
}

/** Parses `git diff -U0 --src-prefix=a/ --dst-prefix=b/` output into per-file added/removed lines with line numbers. */
export function parseUnifiedDiff(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n'); const files = [];
  for (let index = 0; index < lines.length;) {
    if (!lines[index].startsWith('diff --git ')) { index++; continue; }
    const header = readFileHeader(lines, index);
    index = header.index; files.push(header.file);
    while (index < lines.length && lines[index].startsWith('@@')) index = readHunk(lines, index, header.file);
  }
  return files.filter(file => file.path);
}

function untrackedFile(root, path) {
  const file = newFile(path, 'A');
  const full = join(root, path);
  try {
    if (statSync(full).size > MAX_UNTRACKED_BYTES) return file;
    const text = readFileSync(full, 'utf8');
    if (text.includes('\u0000')) return file;
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    if (lines.at(-1) === '') lines.pop();
    file.added = lines.map((line, index) => ({ line: index + 1, text: line }));
  } catch { /* unreadable or vanished: report the file without lines */ }
  return file;
}

/** Working tree vs. the base commit, plus untracked files treated as entirely added. */
export function collectChanges(root, base) {
  const text = git(root, ['diff', '--no-color', '--no-ext-diff', '--no-textconv', '-U0', '--src-prefix=a/', '--dst-prefix=b/', base]);
  const files = parseUnifiedDiff(text);
  const known = new Set(files.map(file => file.path));
  const untracked = git(root, ['ls-files', '--others', '--exclude-standard', '-z']).split('\u0000').filter(Boolean);
  for (const path of untracked) if (!known.has(path)) files.push(untrackedFile(root, path));
  // projects/<name> are standalone projects reviewed by their own gates (projects/README.md).
  return files.filter(file => !file.path.startsWith('projects/'));
}
