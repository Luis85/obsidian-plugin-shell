const reserved = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

function controls(value: string): boolean {
  return [...value].some(character => {
    const code = character.codePointAt(0);
    return code !== undefined && (code < 32 || (code >= 127 && code <= 159));
  });
}

/** Roots that CLI-authored project paths never own. */
export const protectedProjectRoots: readonly string[] = Object.freeze([
  '.git', '.obsidian', '.framework', 'node_modules', '.codex-authoring.lock', '.shell-first-run.lock',
]);

export function hasPortableProjectSegments(path: unknown): path is string {
  return typeof path === 'string' && path.length > 0 && !path.includes('\\') && !path.split('/').some(part =>
    !part || part === '.' || part === '..' || /[<>:"|?*]/.test(part) || controls(part) || /[ .]$/.test(part) || reserved.test(part));
}

export function hasProtectedProjectRoot(path: string, roots: readonly string[] = protectedProjectRoots): boolean {
  return roots.includes(path.split('/')[0]!.toLowerCase());
}
