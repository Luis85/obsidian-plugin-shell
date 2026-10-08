/** Claude Code permission rules: `*` matches any text, a trailing ` *` also matches the bare command;
 * deny wins over ask, ask over allow. Returns the decision for one command. */
export function permission(settings, command) {
  const matches = rule => {
    const pattern = /^Bash\((.*)\)$/.exec(rule)[1];
    const source = pattern.split('*').map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*').replace(/ \.\*$/, '(?: .*)?');
    return new RegExp(`^${source}$`).test(command);
  };
  for (const decision of ['deny', 'ask', 'allow']) if ((settings.permissions[decision] ?? []).some(matches)) return decision;
  return 'unlisted';
}
