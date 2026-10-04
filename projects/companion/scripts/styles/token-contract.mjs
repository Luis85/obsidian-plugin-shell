/** Small checks for our deliberately restricted alias grammar, not a general CSS linter. */
export function declaredTokenNames(css) {
  return [...new Set([...css.matchAll(/^\s*(--[a-zA-Z0-9-]+)\s*:/gm)].map((m) => m[1]))].sort();
}
export function aliasPairs(css) {
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '').trim();
  const match = /^:where\(\.plugin-shell\)\s*\{([^{}]*)\}$/.exec(plain);
  if (!match) throw new Error('TOKEN_ALIAS_SCOPE');
  const declarations = match[1].split(';').map((s) => s.trim()).filter(Boolean);
  const pairs = declarations.map((line) => {
    const found = /^(--plugin-shell-[a-z0-9-]+)\s*:\s*var\((--[a-z0-9-]+)\)$/.exec(line);
    if (!found) throw new Error('TOKEN_ALIAS_GRAMMAR');
    return [found[1], found[2]];
  });
  if (new Set(pairs.map(([name]) => name)).size !== pairs.length) throw new Error('TOKEN_ALIAS_DUPLICATE');
  return pairs;
}
export function validateAliases(css, catalog, observed) {
  const pairs = aliasPairs(css); const known = new Set(catalog.groups.flatMap((g) => g.names).concat(catalog.observedRuntimeFonts));
  const deprecated = new Set(catalog.deprecated.names);
  for (const [, target] of pairs) {
    if (deprecated.has(target)) throw new Error('TOKEN_ALIAS_DEPRECATED');
    if (!known.has(target)) throw new Error('TOKEN_ALIAS_UNKNOWN');
    if (!observed.includes(target)) throw new Error('TOKEN_ALIAS_MISSING_IN_SNAPSHOT');
  }
  return pairs;
}
