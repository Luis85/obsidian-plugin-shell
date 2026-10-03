/** Pure version parsing for the session hooks: the qualified toolchain a checkout declares and conservative range checks. */
import { readFileSync } from 'node:fs';
import { pathFor } from '../shared/platform-path.mjs';

export const version = text => /(\d+)\.(\d+)\.(\d+)/.exec(String(text ?? ''))?.slice(1, 4).map(Number) ?? null;
/** True when both texts name the same major.minor.patch. */
export const sameVersion = (a, b) => Boolean(version(a) && version(b)) && version(a).join('.') === version(b).join('.');
function compare(a, b) { return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]; }
const operators = { '>=': d => d >= 0, '>': d => d > 0, '<=': d => d <= 0, '<': d => d < 0, '=': d => d === 0, '': d => d === 0 };
/** Space-separated comparators only (`>=22.13.0`, `>=11.19.1 <13`); anything else is "unknown" (null), never a false verdict. */
export function satisfies(actual, range) {
  const have = version(actual);
  if (!have || !range || range.includes('||')) return null;
  const parts = range.trim().split(/\s+/).map(part => /^(>=|<=|>|<|=)?v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(part));
  if (parts.some(part => !part)) return null;
  return parts.every(([, operator = '', major, minor = '0', patch = '0']) => operators[operator](compare(have, [Number(major), Number(minor), Number(patch)])));
}
export const readText = path => { try { return readFileSync(path, 'utf8'); } catch { return null; } };
export const readJson = path => { try { return JSON.parse(readText(path)); } catch { return null; } };
/** The qualified toolchain a checkout declares; missing declarations stay null. `platform` selects how `root` is joined (the host's by default). */
export function qualifiedToolchain(root, read = readText, platform = process.platform) {
  const { join } = pathFor(platform);
  const pkg = (() => { try { return JSON.parse(read(join(root, 'package.json'))) ?? {}; } catch { return {}; } })();
  const nvmrc = String(read(join(root, '.nvmrc')) ?? '').trim().replace(/^v/, '');
  const manager = /^npm@(\d+\.\d+\.\d+)/.exec(pkg.packageManager ?? '');
  return { node: version(nvmrc) ? nvmrc : null, nodeRange: pkg.engines?.node ?? null, npm: manager?.[1] ?? null, npmRange: pkg.engines?.npm ?? null };
}
