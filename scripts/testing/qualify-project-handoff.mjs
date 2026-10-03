/** Prove a pushed project works when cloned fresh into a cloud-like session.
 * Generates a project (or takes this framework's committed HEAD), clones it so only committed files exist, replays a cloud
 * SessionStart in the clone and runs the real commands an agent starts with. One JSON summary on stdout; fails closed.
 *   node scripts/testing/qualify-project-handoff.mjs --starter quick-capture --base-node /opt/node22 */
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { baseNodeBin, parseOptions, recordStep, summarize, USAGE } from './handoff-options.mjs';
import { networkAvailable, run, sessionEnvironment } from './handoff-run.mjs';
import * as step from './handoff-steps.mjs';

const frameworkRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PROJECT_STEPS = [['generate', step.generate], ['clone', step.cloneOrigin], ['audit', step.audit], ['session-start', step.sessionStart], ['dependencies', step.dependencies],
  ['toolchain', step.toolchain], ['check', step.check], ['doctor', step.jsonCommand('bin/app doctor', ['bin/app', 'doctor', '--json'])],
  ['ui-status', step.jsonCommand('bin/app ui status', ['bin/app', 'ui', 'status', '--json'])], ['e2e', step.e2e], ['clean-tree', step.cleanTree]];
const FRAMEWORK_STEPS = [['source', step.frameworkSource], ['clone', step.cloneOrigin], ['audit', step.audit], ['session-start', step.sessionStart], ['dependencies', step.dependencies],
  ['toolchain', step.toolchain], ['check', step.frameworkCheck], ['doctor', step.jsonCommand('bin/app doctor', ['bin/app', 'doctor', '--json'])], ['clean-tree', step.cleanTree]];
/** Expected toolchain: .nvmrc and the packageManager npm of the cloned project. */
function expectedToolchain(clone) {
  const read = name => { try { return readFileSync(join(clone, name), 'utf8'); } catch { return ''; } };
  return { node: read('.nvmrc').trim().replace(/^v/, ''), npm: /npm@(\d+\.\d+\.\d+)/.exec(read('package.json'))?.[1] ?? null };
}
function prepare(options) {
  if (options.workDir && existsSync(options.workDir) && readdirSync(options.workDir).length) throw new Error(`--work-dir ${options.workDir} must be empty or absent`);
  const workDir = options.workDir ? resolve(options.workDir) : realpathSync(mkdtempSync(join(tmpdir(), 'project-handoff-')));
  mkdirSync(workDir, { recursive: true });
  const clone = join(workDir, 'clone');
  const baseEnv = { ...process.env };
  const sessionEnv = sessionEnvironment(baseEnv, { clone, envFile: join(workDir, 'claude-env.sh'), cacheDir: resolve(options.cacheDir ?? join(workDir, 'cache')), baseBin: baseNodeBin(options.baseNode) });
  return { options, frameworkRoot, workDir, origin: join(workDir, 'origin'), clone, envFile: join(workDir, 'claude-env.sh'), cacheDir: sessionEnv.XDG_CACHE_HOME, baseEnv, sessionEnv, toolEnv: null, offline: false, expected: { node: null, npm: null } };
}
async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (options.help || options.error) { process.stdout.write(`${options.error ? `${options.error}\n` : ''}${USAGE}\n`); return options.error ? 2 : 0; }
  const started = Date.now();
  const context = prepare(options);
  const nodeProbe = run('node', ['--version'], { env: context.sessionEnv });
  context.offline = !(await networkAvailable(context.sessionEnv));
  const steps = [];
  for (const [name, body] of options.target === 'framework' ? FRAMEWORK_STEPS : PROJECT_STEPS) {
    context.expected = expectedToolchain(existsSync(context.clone) ? context.clone : frameworkRoot);
    await recordStep(steps, name, () => body(context));
    if (name === 'clone' && steps.at(-1).status === 'failed') break;
  }
  const { status, exitCode } = summarize(steps);
  const summary = { schema: 'workbench.project-handoff/1', status, target: options.target, ...(options.target === 'project' ? { starter: options.starter } : {}), offline: context.offline,
    simulatedNode: nodeProbe.stdout.trim() || null, expected: context.expected, durationMs: Date.now() - started, ...(options.keep ? { workDir: context.workDir } : {}), steps };
  const text = JSON.stringify(summary, null, 2);
  if (options.out) { mkdirSync(dirname(resolve(options.out)), { recursive: true }); writeFileSync(resolve(options.out), `${text}\n`); }
  process.stdout.write(`${text}\n`);
  if (!options.keep) rmSync(context.workDir, { recursive: true, force: true });
  return exitCode;
}
process.exitCode = await main().catch(error => { process.stderr.write(`${error?.stack ?? error}\n`); return 1; });
