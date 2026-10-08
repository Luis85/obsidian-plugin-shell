import { hasControls } from '#shared/contracts/sketch-errors.ts';
/** Portable relative file identity. This validates names, not filesystem containment. */
export function portableFile(path: string): boolean {
  return path.length > 0 && path.length <= 2048 && !path.includes('\\') && path.split('/').every(part =>
    part.length > 0 && part !== '.' && part !== '..' && !/[<>:"|?*]/.test(part) && !hasControls(part) && !/[ .]$/.test(part) &&
    !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part));
}
