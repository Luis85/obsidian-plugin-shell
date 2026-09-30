/** Snapshot reviewed tooling outside the checkout before registering an auto-starting MCP process. */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { digest, requireThat } from './policy.ts';
import { noSymlink, readText, type Paths } from './io.ts';
// Paths relative to scripts/: the snapshot keeps that layout so the launcher's relative imports resolve inside it.
const FILES = [...['cli.ts', 'desktop.ts', 'embedded.py', 'install.ts', 'io.ts', 'launcher.ts', 'mcp.ts', 'policy.ts', 'provider.ts', 'sources.ts'].map(name => 'hindsight/' + name),
  'companion/tooling-contract.mjs', 'shared/hash.ts'];
export const launcherEntry = 'hindsight/cli.ts';
const PACKAGE = '{"type":"module","private":true}\n';
export interface LauncherPlan { source: string; directory: string; digest: string; files: { name: string; sha256: string }[] }
export function launcherPlan(p: Paths, source = dirname(dirname(fileURLToPath(import.meta.url)))): LauncherPlan {
  const files = FILES.map(name => {
    const text = readText(join(source, name));
    requireThat(text !== null, 'LAUNCHER_SOURCE_MISSING', 'The reviewed launcher source is incomplete. Restore the checkout before connecting.');
    return { name, sha256: digest(text) };
  });
  files.push({ name: 'package.json', sha256: digest(PACKAGE) });
  const hash = digest(JSON.stringify(files));
  return { source, directory: join(p.state, 'launchers', hash), digest: hash, files };
}
export function stageLauncher(p: Paths, plan: LauncherPlan): void {
  const current = launcherPlan(p, plan.source);
  requireThat(current.digest === plan.digest && resolve(current.directory) === resolve(plan.directory), 'PLAN_CHANGED', 'Launcher source changed since review. Create a fresh connection plan.');
  const matches = () => current.files.every(file => {
    const path = join(current.directory, file.name); noSymlink(path);
    return existsSync(path) && digest(readFileSync(path, 'utf8')) === file.sha256;
  });
  noSymlink(current.directory);
  if (existsSync(current.directory)) {
    requireThat(matches(), 'LAUNCHER_CHANGED', 'A previously staged launcher differs from its fingerprint. Preserve it for inspection; do not run it.'); return;
  }
  const parent = dirname(current.directory); mkdirSync(parent, { recursive: true, mode: 0o700 });
  const temporary = mkdtempSync(join(parent, '.stage-'));
  try {
    for (const file of current.files) {
      const text = file.name === 'package.json' ? PACKAGE : readText(join(current.source, file.name));
      requireThat(text !== null && digest(text) === file.sha256, 'PLAN_CHANGED', 'Launcher source changed during staging. No desktop configuration was written.');
      mkdirSync(dirname(join(temporary, file.name)), { recursive: true, mode: 0o700 });
      writeFileSync(join(temporary, file.name), text, { flag: 'wx', mode: 0o600 });
    }
    renameSync(temporary, current.directory);
  } finally { if (existsSync(temporary)) rmSync(temporary, { recursive: true }); }
}
