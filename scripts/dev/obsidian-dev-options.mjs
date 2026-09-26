import { sandboxDirectory } from './obsidian-sandbox.mjs';

export const devUsage = `Usage: npm run dev:obsidian -- [options]
Build, watch and hot-reload the plugin in real Obsidian on a contained sandbox vault.
  --once, --headless   Build, launch, reload once, capture logs + screenshot, print JSON, exit
  --json               Same as --once; stdout carries only the JSON summary (status goes to stderr)
  --port <n>           Remote debugging port on 127.0.0.1 (default 9222, env OBSIDIAN_DEBUG_PORT)
  --logs plugin|all    Terminal/log filter: plugin output plus every error (default), or all
  --settle <ms>        Once mode: wait after reload before collecting (default 1500)
  --sandbox <.name>    Sandbox directory in this checkout: .obsidian-sandbox or .obsidian-sandbox-<suffix>
  --no-debug-logging   Do not run the plugin's debug-toggle command after each load
  --allow-download     Opt in to provisioning obsidian-launcher/Obsidian (env OBSIDIAN_ALLOW_DOWNLOAD=1)
The sandbox is seeded once from tests/obsidian/vault and never replaced; personal vaults are never opened.`;

function integer(value, name, min, max) {
  if (!/^\d+$/.test(value ?? '')) throw new Error(`DEV_OPTION_INVALID: ${name}`);
  const number = Number(value);
  if (number < min || number > max) throw new Error(`DEV_OPTION_RANGE: ${name}`);
  return number;
}
/** Pure parser: no filesystem, process or network access. */
export function parseDevOptions(argv, env = {}) {
  const options = { once: false, port: 9222, logs: 'plugin', settleMs: 1500, sandbox: '.obsidian-sandbox',
    debugLogging: true, allowDownload: env.OBSIDIAN_ALLOW_DOWNLOAD === '1', help: false };
  if (env.OBSIDIAN_DEBUG_PORT !== undefined) options.port = integer(env.OBSIDIAN_DEBUG_PORT, 'OBSIDIAN_DEBUG_PORT', 1024, 65535);
  const seen = new Set();
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    const key = arg === '--headless' ? '--once' : arg;
    if (seen.has(key)) throw new Error(`DEV_OPTION_DUPLICATE: ${arg}`);
    seen.add(key);
    const value = () => { const next = argv[++index]; if (next === undefined || next.startsWith('--')) throw new Error(`DEV_OPTION_VALUE_MISSING: ${arg}`); return next; };
    if (key === '--once' || key === '--json') options.once = true;
    else if (arg === '--port') options.port = integer(value(), '--port', 1024, 65535);
    else if (arg === '--logs') { options.logs = value(); if (!['plugin', 'all'].includes(options.logs)) throw new Error('DEV_OPTION_INVALID: --logs'); }
    else if (arg === '--settle') options.settleMs = integer(value(), '--settle', 0, 120000);
    else if (arg === '--sandbox') options.sandbox = sandboxDirectory(value());
    else if (arg === '--no-debug-logging') options.debugLogging = false;
    else if (arg === '--allow-download') options.allowDownload = true;
    else if (arg === '--help') options.help = true;
    else throw new Error(`DEV_OPTION_UNKNOWN: ${arg}`);
  }
  return options;
}
