import { spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stagedBuild } from '../bundling/staged-build.mjs';
import { ProvisionRequired, assertHostPath, downloadAllowed, provisionHost, requestedAppVersion } from './obsidian-host.mjs';
import { ensureDisplay } from './obsidian-display.mjs';

const usage = `Usage: npm run test:obsidian -- [--allow-download] [--no-build] [vitest filters/options]
Builds the plugin, then runs tests/obsidian/**/*.obsidian.ts against real Obsidian. Each case gets a
fresh copy of tests/obsidian/vault under .nq/ with the built plugin enabled there only.
Provisioning (obsidian-launcher into .native-runner, Obsidian into .native-cache) needs --allow-download
or OBSIDIAN_ALLOW_DOWNLOAD=1. OBSIDIAN_VERSION selects the host (default 1.13.7). Evidence: reports/obsidian/.`;

/** Split runner flags from arguments forwarded to Vitest. */
export function parseRunnerArguments(argv) {
  const options = { allowDownload: false, build: true, help: false, vitest: [] };
  for (const arg of argv) {
    if (arg === '--allow-download') options.allowDownload = true;
    else if (arg === '--no-build') options.build = false;
    else if (arg === '--help') options.help = true;
    else options.vitest.push(arg);
  }
  return options;
}
async function main(argv) {
  const options = parseRunnerArguments(argv);
  if (options.help) { console.log(usage); return 0; }
  try { assertHostPath(); await provisionHost({ allowDownload: options.allowDownload || downloadAllowed([], process.env), appVersion: requestedAppVersion() }); }
  catch (error) {
    if (error instanceof ProvisionRequired || error.message.startsWith('NATIVE_SOCKET_PATH_TOO_LONG')) { console.error(error.message); return 2; }
    throw error;
  }
  if (options.build) {
    const candidate = await stagedBuild();
    console.log(`Built ${candidate.version} candidate in dist/.`);
  }
  const display = await ensureDisplay();
  try { return await runVitest(options.vitest); }
  finally { await display.stop(); }
}
async function runVitest(args) {
  await rm(resolve('reports/obsidian'), { recursive: true, force: true });
  await mkdir(resolve('reports/obsidian/cases'), { recursive: true });
  const child = spawn(process.execPath, [resolve('node_modules/vitest/vitest.mjs'), 'run', '--config', 'vitest.obsidian.config.mjs', ...args], { stdio: 'inherit' });
  const forward = signal => { child.kill(signal); };
  process.on('SIGINT', forward); process.on('SIGTERM', forward);
  return new Promise((ok, fail) => {
    child.once('error', fail);
    child.once('exit', (code, signal) => { process.off('SIGINT', forward); process.off('SIGTERM', forward); ok(code ?? (signal ? 1 : 0)); });
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code; }, error => { console.error(error.stack ?? error.message); process.exitCode = 1; });
}
