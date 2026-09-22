// Dependency-free first-run installer. The full identity/maker wizard remains a later package.
import { readFile, access } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { resolve } from 'node:path';
import { runNode } from './shared/process.mjs';
const accepted = new Set(['--yes', '--no-interaction', '--dry-run', '--skip-install', '--no-local', '--help']);
async function setup() {
  const flags = new Set(process.argv.slice(2));
  for (const flag of flags) if (!accepted.has(flag)) throw new Error(`Unknown option: ${flag}`);
  if (flags.has('--help')) { console.log('npm run setup -- [--yes --no-interaction] [--dry-run] [--skip-install] [--no-local]'); return; }
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 12)) throw new Error('Node 22.12+ is required. Node 24.21.0 is the qualified development version.');
  const manifest = JSON.parse(await readFile('manifest.json', 'utf8')); await access('package-lock.json');
  const local = !flags.has('--no-local');
  console.log(`Plugin Shell — iteration 01 setup
Plugin: ${manifest.name} (${manifest.id})
Node: ${process.version}
1. Install the exact lockfile${flags.has('--skip-install') ? ' [explicitly skipped]' : ''}
2. Build and type-check the Nuxt UI showcase
3. Run the service tests
4. ${local ? 'Install to .dev-vault/.obsidian/plugins/' + manifest.id : 'Browser-only profile'}

No notes, global packages, security preferences, Git identity or releases are changed.
The complete template-renaming and maker wizard remains planned; this installs the working showcase.
`);
  if (flags.has('--dry-run')) { console.log('Dry run: no writes, installation or network requests.'); return; }
  if (!flags.has('--yes')) {
    if (!stdin.isTTY || flags.has('--no-interaction')) throw new Error('Noninteractive setup requires --yes after reviewing --dry-run.');
    const prompt = createInterface({ input: stdin, output: stdout });
    try { if (!/^y(es)?$/i.test((await prompt.question('Continue with this plan? [y/N] ')).trim())) { console.log('Cancelled; no changes.'); return; } }
    finally { prompt.close(); }
  }
  if (!flags.has('--skip-install')) {
    const npm = process.env.npm_execpath;
    if (!npm) throw new Error('Run setup through npm run setup so its npm launcher is known.');
    await runNode(npm, ['ci', '--no-fund']);
  }
  await runNode('scripts/build/build.mjs');
  await runNode('node_modules/vue-tsc/bin/vue-tsc.js', ['--noEmit']);
  await runNode('node_modules/vitest/vitest.mjs', ['run']);
  if (local) await runNode('scripts/dev/install-local.mjs', ['--no-build']);
  console.log(`
Setup completed.
Browser: npm run dev:ui
Obsidian: open ${resolve('.dev-vault')}, enable ${manifest.name}, then run “Open capability showcase”.
Full browser/native/release qualification is separate: npm run help.`);
}
setup().catch(error => { console.error(`Setup stopped: ${error.message}
Completed steps are retained. Fix the reported issue and rerun; no user data is reset.`); process.exitCode = 1; });
