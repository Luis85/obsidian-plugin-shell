/** Path and PATH-variable semantics for a named platform. Code that takes a `platform` option uses these instead of the host's
 * `node:path`, so a simulated platform yields that platform's separators on every host; code that touches the real file system
 * passes `process.platform`, which selects the host's own flavour. */
import path from 'node:path';

/** `path.win32` for 'win32', else `path.posix`. */
export const pathFor = platform => (platform === 'win32' ? path.win32 : path.posix);
/** The PATH variable's key: Windows environments are case-insensitive and usually spell it `Path`. */
export function pathKey(env, platform = process.platform) {
  if (platform !== 'win32') return 'PATH';
  return Object.keys(env).find(key => key.toUpperCase() === 'PATH') ?? 'PATH';
}
/** A copy of `env` whose PATH starts with `directory` (under the key the platform already uses, never a second spelling). */
export function withPathFirst(env, directory, platform = process.platform) {
  const key = pathKey(env, platform);
  const rest = env[key];
  return { ...env, [key]: rest ? `${directory}${pathFor(platform).delimiter}${rest}` : directory };
}
/** A directory as the agent's POSIX-style shell writes it into PATH: Git Bash on Windows wants `/c/Program Files/nodejs`. */
export function shellPath(directory, platform = process.platform) {
  if (platform !== 'win32') return directory;
  const posix = directory.replace(/\\/g, '/');
  return /^[A-Za-z]:\//.test(posix) ? `/${posix[0].toLowerCase()}${posix.slice(2)}` : posix;
}
