/**
 * Repository path globs for the delivery checks: `**` crosses folders, `*` and `?` stay inside one segment.
 * A pattern without a glob character matches the path itself and everything below it as a folder.
 */
const cache = new Map();
const escape = text => text.replace(/[.+^${}()|[\]\\]/g, '\\$&');

export const isGlob = pattern => /[*?]/.test(pattern);

/** The anchored regular expression for one repository-relative glob. */
export function globRegExp(pattern) {
  if (cache.has(pattern)) return cache.get(pattern);
  let source = '';
  for (let index = 0; index < pattern.length; index++) {
    const char = pattern[index];
    if (char === '*' && pattern[index + 1] === '*') {
      const slash = pattern[index + 2] === '/';
      source += slash ? '(?:.*/)?' : '.*';
      index += slash ? 2 : 1;
    } else if (char === '*') source += '[^/]*';
    else if (char === '?') source += '[^/]';
    else source += escape(char);
  }
  const expression = new RegExp(`^${source}$`);
  cache.set(pattern, expression);
  return expression;
}

/** True when `path` matches the glob, or sits at or below a plain path. */
export function matchesPath(pattern, path) {
  const clean = pattern.replace(/^\.\//, '');
  if (isGlob(clean)) return globRegExp(clean).test(path);
  const folder = clean.replace(/\/+$/, '');
  return path === folder || path.startsWith(`${folder}/`);
}

export const matchesAny = (patterns, path) => patterns.some(pattern => matchesPath(pattern, path));

/** The leading folders of a pattern before its first glob segment ("src/a/**" gives "src/a/"). */
export function staticPrefix(pattern) {
  const segments = pattern.replace(/^\.\//, '').split('/');
  const fixed = [];
  for (const segment of segments) { if (isGlob(segment)) break; fixed.push(segment); }
  return fixed.length === segments.length ? fixed.join('/') : fixed.map(segment => `${segment}/`).join('');
}

/** True when a repository-relative path is safe: no absolute path, drive, backslash or `..` segment. */
export function safeRelative(path) {
  return typeof path === 'string' && path.length > 0 && !/^(?:\/|[A-Za-z]:|\\)/.test(path) && !path.includes('\\')
    && !path.split('/').includes('..');
}
