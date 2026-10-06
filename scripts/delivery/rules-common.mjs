/**
 * Shared pieces of the Definition of Ready and Done rules: result constructors, the document kinds a rule
 * declares in `appliesTo`, repository lookups and the frontmatter checks every delivery document shares.
 */

/** Document kinds: an Increment (the handoff), a PullRequest (one planned pull request) and an Issue. */
export const increment = Object.freeze(['Increment']);
export const pullRequest = Object.freeze(['PullRequest']);
export const changeDocuments = Object.freeze(['PullRequest', 'Issue']);
/** Diff-scoped rules run for an increment-level pull request and for a change pull request alike. */
export const anyPullRequest = Object.freeze(['Increment', 'PullRequest']);

export const pass = (message, details) => ({ status: 'pass', message, ...(details?.length ? { details } : {}) });
export const fail = (message, hint, details) => ({ status: 'fail', message, hint, ...(details?.length ? { details } : {}) });
export const skip = message => ({ status: 'skip', message });
export const list = (items, limit = 6) => items.slice(0, limit).join(', ') + (items.length > limit ? ` and ${items.length - limit} more` : '');

/**
 * One source line with the contents of its string and template literals removed, so a pattern only sees code and
 * comments. Text after a comment opener is kept verbatim (apostrophes in prose are not quotes); a literal that does not
 * close on the line is dropped to the end of the line. `keep(contents)` may put a placeholder between the quotes
 * (the self-review guard marks a non-empty literal); by default the quotes are left empty.
 */
export function codeText(line, keep = () => '') {
  if (/^\s*\*/.test(line)) return line;
  let out = '';
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '/' && (line[index + 1] === '/' || line[index + 1] === '*')) return out + line.slice(index);
    if (char !== "'" && char !== '"' && char !== '`') { out += char; continue; }
    let end = index + 1;
    while (end < line.length && line[end] !== char) end += line[end] === '\\' ? 2 : 1;
    out += char + keep(line.slice(index + 1, end)) + char; index = end;
  }
  return out;
}

/** An evidence reference without its `#anchor` or `:line[:column]` suffix. */
export const evidencePath = value => value.replace(/#.*$/, '').replace(/:\d+(?::\d+)?$/, '');
/** True when a repository file is the path, or sits under it as a folder. */
export function known(files, path) {
  const folder = path.replace(/\/+$/, '');
  return files.some(file => file === folder || file.startsWith(`${folder}/`));
}
/** An Obsidian wikilink target resolves to a Markdown file by repository path (with or without .md) or by basename. */
export function resolveWikilink(files, target) {
  const name = target.split('|')[0].split('#')[0].trim().replace(/^\.\//, '');
  if (!name) return false;
  if (name.includes('/')) return files.includes(name) || files.includes(`${name}.md`);
  const wanted = name.replace(/\.md$/i, '').toLowerCase();
  return files.some(file => file.endsWith('.md') && file.split('/').at(-1).slice(0, -3).toLowerCase() === wanted);
}

/** Frontmatter keys whose value is a `[list]`; every other key is a single value. */
const listKeys = new Set(['refs', 'pullRequests', 'issues', 'delivers']);

/**
 * Problems of a document frontmatter against its settings ({ type, requiredKeys, optionalKeys, statuses }):
 * required and unknown keys, the type, the id (a slug equal to the file name), the status and value shapes.
 */
export function frontmatterProblems(frontmatter, path, settings, { allowUnknownKeys, slugPattern, maxSlugLength }) {
  const data = frontmatter.data;
  if (!frontmatter.present) return ['the file does not start with a --- frontmatter block'];
  const problems = frontmatter.errors.map(error => `line ${error.line}: ${error.message}`);
  for (const key of settings.requiredKeys) if (!data[key] || (Array.isArray(data[key]) && !data[key].length)) problems.push(`${key} is missing or empty`);
  if (!allowUnknownKeys) for (const key of Object.keys(data)) if (![...settings.requiredKeys, ...settings.optionalKeys].includes(key)) problems.push(`unknown key ${key}`);
  if (data.type && data.type !== settings.type) problems.push(`type must be ${settings.type}`);
  const slug = path.split('/').at(-1).replace(/\.md$/, '');
  if (typeof data.id === 'string' && data.id && (!new RegExp(slugPattern, 'u').test(data.id) || data.id.length > maxSlugLength)) problems.push(`id "${data.id}" is not a slug of at most ${maxSlugLength} characters`);
  if (typeof data.id === 'string' && data.id && data.id !== slug) problems.push(`id "${data.id}" differs from the file name "${slug}"`);
  if (typeof data.status === 'string' && data.status && !settings.statuses.includes(data.status)) problems.push(`status must be one of ${settings.statuses.join(', ')}`);
  for (const [key, value] of Object.entries(data)) {
    if (listKeys.has(key) && !Array.isArray(value)) problems.push(`${key} must be a [list]`);
    if (!listKeys.has(key) && Array.isArray(value)) problems.push(`${key} must be a single value, not a list`);
  }
  return problems;
}
