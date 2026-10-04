/** Map a raw colour finding to reviewed Obsidian tokens from docs/design/obsidian-tokens.json. */
const byNamedColour = { red: '--color-red', orange: '--color-orange', yellow: '--color-yellow', green: '--color-green', cyan: '--color-cyan',
  blue: '--color-blue', purple: '--color-purple', pink: '--color-pink', white: '--text-on-accent', black: '--text-normal' };
const byProperty = [
  [/shadow/i, ['--background-modifier-border', '--shadow-s']],
  [/^(?:border|outline|column-rule)|stroke/i, ['--background-modifier-border', '--background-modifier-border-focus']],
  [/^background|^fill|gradient/i, ['--background-primary', '--background-secondary', '--interactive-accent']],
  [/caret/i, ['--caret-color']],
  [/color|decoration/i, ['--text-normal', '--text-muted', '--text-accent', '--text-error']],
];
/** Suggested tokens always exist in the reviewed catalog; unknown names are dropped instead of invented. */
export function suggestTokens(finding, catalog) {
  const known = new Set(catalog.groups.flatMap((group) => group.names));
  const picks = [];
  if (finding.kind === 'named' && byNamedColour[finding.literal.toLowerCase()]) picks.push(byNamedColour[finding.literal.toLowerCase()]);
  const property = finding.property ?? '';
  for (const [pattern, names] of byProperty) if (pattern.test(property)) { picks.push(...names); break; }
  if (!picks.length) picks.push('--text-normal', '--background-primary');
  return [...new Set(picks)].filter((name) => known.has(name)).map((name) => 'var(' + name + ')');
}
