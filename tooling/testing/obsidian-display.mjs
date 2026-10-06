import { spawn, spawnSync } from 'node:child_process';

/** Decide how a real Obsidian window can be shown. Only Linux without a display uses Xvfb. */
export function displayPlan({ platform = process.platform, env = process.env, xvfbAvailable = false } = {}) {
  if (platform !== 'linux' || env.DISPLAY || env.WAYLAND_DISPLAY) return 'direct';
  return xvfbAvailable ? 'xvfb' : 'missing';
}
function xvfbInstalled() {
  const probe = spawnSync('sh', ['-c', 'command -v Xvfb'], { encoding: 'utf8' });
  return probe.status === 0 && Boolean(probe.stdout.trim());
}
/** Parse Xvfb's `-displayfd` announcement (the chosen display number and a newline). */
export function parseDisplayNumber(text) {
  const match = /^(\d+)\n/.exec(text);
  return match ? Number(match[1]) : null;
}
/** Start a private Xvfb server for this process (and the Obsidian it launches) when no display exists.
 * The server picks a free display itself; stdout/stderr of this process stay untouched. */
export async function ensureDisplay({ log = message => console.error(message), timeout = 10000, track = () => undefined } = {}) {
  const plan = displayPlan({ xvfbAvailable: process.platform === 'linux' && xvfbInstalled() });
  if (plan === 'direct') return { display: process.env.DISPLAY ?? null, virtual: false, stop: async () => undefined };
  if (plan === 'missing') throw new Error('OBSIDIAN_DISPLAY_MISSING: no DISPLAY/WAYLAND_DISPLAY and no Xvfb. Install Xvfb or run under `xvfb-run -a`.');
  const server = spawn('Xvfb', ['-displayfd', '3', '-screen', '0', '1920x1080x24', '-nolisten', 'tcp'], { stdio: ['ignore', 'ignore', 'pipe', 'pipe'] });
  const stop = async () => {
    if (server.exitCode !== null || server.signalCode !== null) return;
    const exited = new Promise(ok => server.once('exit', ok));
    server.kill('SIGTERM');
    await Promise.race([exited, new Promise(ok => setTimeout(ok, 5000))]);
    if (server.exitCode === null && server.signalCode === null) server.kill('SIGKILL');
  };
  // Tracked before it is ready, so an interrupt during startup still stops the server.
  track(stop, () => server.kill('SIGKILL'));
  let announced = ''; let diagnostics = '';
  server.stderr.on('data', data => { diagnostics = (diagnostics + data).slice(-4000); });
  let number;
  try {
    number = await new Promise((ok, fail) => {
      const timer = setTimeout(() => fail(new Error(`OBSIDIAN_XVFB_TIMEOUT: ${diagnostics}`)), timeout);
      server.stdio[3].on('data', data => {
        announced += data; const value = parseDisplayNumber(announced);
        if (value !== null) { clearTimeout(timer); ok(value); }
      });
      server.once('exit', code => { clearTimeout(timer); fail(new Error(`OBSIDIAN_XVFB_EXITED (${code}): ${diagnostics}`)); });
      server.once('error', error => { clearTimeout(timer); fail(error); });
    });
  } catch (error) { await stop(); throw error; }
  process.env.DISPLAY = `:${number}`;
  log(`No display found; started a private Xvfb display :${number}.`);
  return { display: `:${number}`, virtual: true, stop };
}
