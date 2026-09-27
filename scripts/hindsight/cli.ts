/** Optional developer command; safe to run without npm dependencies or Python installed. */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { paths, readConfig, saveConfig, locked, repository, backend, run, npmCommand, noSymlink } from './io.ts';
import { checkExisting, configuredEndpoint, consent, disabled, MemoryError, requireEnabled, requireThat, seedPlan } from './policy.ts';
import { installationPlan, install } from './install.ts';
import { committedDocuments, pullRequestContext } from './sources.ts';

const HELP = `Optional Hindsight developer memory (never runs during npm install/setup/build).
  npm run memory -- install --agents claude-code,codex       # preview only
  npm run memory -- install --agents codex --apply --accept-data-processing
  npm run memory -- status                                 # no daemon start
  npm run memory -- start --apply                           # explicit persistent daemon
  npm run memory -- stop --apply                            # shared local profile
  npm run memory -- disable --apply                         # this bank; retain its data
  npm run memory -- seed --file docs/memory/decisions/example.md
  npm run memory -- seed --file docs/memory/decisions/example.md --apply --plan HASH
  npm run memory -- pr-context --pr 5                       # read-only GitHub CLI
Install options: --git none|message|full (default message), --sessions (off by default),
  --python PATH (default python3 / Windows python). --json emits the same JSON contract.
Every modifying command requires --apply; --dry-run and --apply are mutually exclusive.
Read docs/development/HINDSIGHT.md before opting in. No keys belong in CLI arguments.`;
const OPTIONS = { help: { type: 'boolean' }, apply: { type: 'boolean' }, 'dry-run': { type: 'boolean' },
  json: { type: 'boolean' }, agents: { type: 'string' }, git: { type: 'string' },
  sessions: { type: 'boolean' }, 'accept-data-processing': { type: 'boolean' },
  python: { type: 'string' }, file: { type: 'string', multiple: true }, plan: { type: 'string' },
  pr: { type: 'string' } } as const;
const ALLOWED: Record<string, string[]> = {
  install: ['agents', 'git', 'sessions', 'accept-data-processing', 'python'],
  status: [], start: [], stop: [], disable: [], seed: ['file', 'plan'], 'pr-context': ['pr'],
};
function main(args = process.argv.slice(2)): void {
  const { values, positionals } = parseArgs({ args, options: OPTIONS, allowPositionals: true, strict: true });
  if (values.help || positionals.length === 0) { console.log(HELP); return; }
  const command = positionals[0]!;
  requireThat(positionals.length === 1 && Object.hasOwn(ALLOWED, command), 'COMMAND_INVALID', 'Unknown command; use --help.');
  requireThat(!(values.apply && values['dry-run']), 'FLAGS_INVALID', '--apply and --dry-run cannot be combined.');
  for (const key of Object.keys(values)) requireThat(['json', 'apply', 'dry-run'].includes(key) || ALLOWED[command]!.includes(key),
    'FLAGS_INVALID', 'An option does not belong to this command; use --help.');
  requireThat(!['status', 'pr-context'].includes(command) || !values.apply, 'FLAGS_INVALID', 'Read-only commands do not accept --apply.');
  const p = paths(); const repo = repository(process.cwd());
  requireThat(!process.env.HINDSIGHT_CONFIG || resolve(process.env.HINDSIGHT_CONFIG) === resolve(p.config),
    'CONFIG_CONFLICT', 'A custom HINDSIGHT_CONFIG is active. Reconcile it before installing user-scope hooks.');
  const existing = readConfig(p.config);
  const print = (value: unknown) => console.log(JSON.stringify(value, null, 2));
  if (command === 'status') {
    let enabled = false; let code = 'NOT_ENABLED';
    try { requireEnabled(existing.data, repo); enabled = true; code = 'ENABLED'; }
    catch (error) { if (error instanceof MemoryError) code = error.code; else throw error; }
    print({ schemaVersion: 1, code, enabled, bank: repo.bank, pythonEnvironmentPresent: existsSync(p.python),
      agentRuntimePresent: existsSync(p.installer), daemonProbed: false,
      next: 'Status never starts/probes a daemon. Use start --apply and the agent hindsight_diagnose tool for live health.' }); return;
  }
  if (command === 'pr-context') { print(pullRequestContext(repo, values.pr ?? '')); return; }
  checkExisting(existing.data);
  if (command === 'install') {
    const choice = consent(values.agents ?? '', values.git ?? 'message', Boolean(values.sessions));
    if (!values.apply) { print(installationPlan(repo, p, choice)); return; }
    requireThat(values['accept-data-processing'], 'CONSENT_REQUIRED', 'Review the plan and explicitly add --accept-data-processing.');
    requireThat(!(process.platform === 'darwin' && process.arch === 'x64'), 'PLATFORM_UNSUPPORTED',
      'Intel macOS requires a separately reviewed slim deployment with external embedding/reranking providers; see the guide.');
    requireThat(process.env.HINDSIGHT_API_LLM_PROVIDER && process.env.HINDSIGHT_API_LLM_MODEL,
      'LLM_CONFIG_REQUIRED', 'Set HINDSIGHT_API_LLM_PROVIDER and HINDSIGHT_API_LLM_MODEL explicitly in your environment; do not pass credentials as arguments.');
    [p.venv, p.runtime, p.config].forEach(noSymlink);
    const python = values.python ?? (process.platform === 'win32' ? 'python' : 'python3');
    const result = locked(p.state, () => install(repo, p, choice, python, {
      execute: (cmd, argv) => { run(cmd, argv, { timeout: 1200000 }); },
      npm: argv => { const cmd = npmCommand(argv); run(cmd.command, cmd.args, { timeout: 1200000 }); },
      backend: cmd => backend(p, cmd, { approved: true }), read: () => readConfig(p.config),
      save: (data, original) => saveConfig(p.config, data, original), pythonExists: () => existsSync(p.python),
      announce: stage => console.error(`[hindsight] ${stage}`),
    })); print(result); return;
  }
  if (command === 'seed') {
    const docs = committedDocuments(repo, values.file ?? []); const plan = seedPlan(repo, docs);
    if (!values.apply) { print(plan); return; }
    requireThat(values.plan === plan.planHash, 'PLAN_CHANGED', 'Supply the exact reviewed --plan hash; HEAD or source content may have changed.');
    print(locked(p.state, () => {
      const url = requireEnabled(readConfig(p.config).data, repo);
      return backend(p, 'retain', { url, bank: repo.bank, documents: docs, approved: true });
    })); return;
  }
  if (!values.apply) {
    print({ schemaVersion: 1, operation: command, bank: repo.bank, apply: false,
      warning: command === 'stop' ? 'Stops the shared obsidian-shell profile for every opted-in project; no data is deleted.' : 'Add --apply to execute. Disable takes effect fully after restarting agents.' }); return;
  }
  print(locked(p.state, () => {
    const current = readConfig(p.config);
    if (command === 'disable') {
      requireEnabled(current.data, repo);
      saveConfig(p.config, disabled(current.data, repo), current.original);
      return { ok: true, code: 'DISABLED', bank: repo.bank, next: 'Restart agents/MCP processes. Data and user hooks were preserved.' };
    }
    const url = command === 'stop' ? configuredEndpoint(current.data, repo) : requireEnabled(current.data, repo);
    return backend(p, command, { url, approved: true });
  }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(); }
  catch (error) {
    const safe = error instanceof MemoryError ? error : new MemoryError('COMMAND_FAILED',
      'Command failed. Existing data was not automatically deleted. Check the guide and local prerequisites; raw errors are withheld to protect secrets.');
    console.error(JSON.stringify({ ok: false, code: safe.code, message: safe.message })); process.exitCode = 1;
  }
}
