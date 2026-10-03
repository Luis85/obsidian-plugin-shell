/** Explicit, dependency-free developer-memory entry. Importing it never installs or starts services. */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual, parseArgs } from 'node:util';
import { paths, readConfig, readText, saveConfig, locked, repository, backend, run, npmCommand, noSymlink, type Paths } from './io.ts';
import { checkExisting, configuredEndpoint, consent, disabled, MemoryError, requireEnabled, requireThat, seedPlan, type Identity, type JsonObject } from './policy.ts';
import { installationPlan, install } from './install.ts';
import { committedDocuments, pullRequestContext } from './sources.ts';
import { PROVIDERS, providerPlan, providerSettings, type ProviderSettings } from './provider.ts';
import { applyConnection, connection, connectionStatus, desktopClient } from './desktop.ts';
import { discoverTools, launchMcp, nativeServer } from './mcp.ts';
import { hindsightOptions } from '../companion/tooling-contract.mjs';

const HELP = `Optional project memory — node bin/app memory <command>
The equivalent npm entry is npm run memory -- <command>. All receipts are JSON.

Getting started (preview first, then repeat with --apply --accept-data-processing):
  setup --agents claude-code,codex --provider openai-codex
  setup --agents claude-code --provider claude-code
  setup --agents claude-code,codex --provider ollama --model YOUR_LOCAL_MODEL
  setup --agents codex --provider none                  # storage/recall, no synthesis

Configuration and lifecycle:
  providers                                             # keyless choices and prerequisites
  configure --provider NAME [--model ID] [--base-url URL] [--auth-home PATH] [--apply]
  install --agents claude-code,codex [--provider NAME]   # packages + official hooks only
  status                                                # no daemon start or probe
  doctor [--live]                                        # safe diagnostics; no inference
  start|stop|disable [--apply]                           # never deletes memories
  connect|disconnect --client claude-code|codex|claude-desktop [--apply]
  tools --agent codex [--live]                          # actual MCP initialize/list; no tool calls

Using memory:
  recall|reflect --query TEXT [--apply]                  # explicit processing; low budget
  seed --file docs/memory/decisions/FILE.md              # exact committed blobs; preview
  seed --file docs/memory/decisions/FILE.md --apply --plan HASH
  pr-context --pr NUMBER                                # read-only gh API; never retained
  mcp --agent claude-code|codex [--root PATH]            # registered stdio server launcher

Setup installs AND connects the selected Claude Code/Codex desktop clients.
Install choices: --git none|message|full (default message), --sessions (default off),
--python PATH. An agent-ready project may supply reviewed agent/privacy defaults, but setup still previews first
and apply still requires --accept-data-processing. No global npm install or implicit install-all. Keyless does not mean
no inference, no account limits or offline. None mode cannot reflect or synthesize pages.
Connect permits future autostart only inside an explicitly opted-in repository.
Use local desktop sessions; cloud sessions cannot access this machine's service.
Every modifying command needs --apply. --dry-run conflicts with --apply.
See HINDSIGHT.md. No credentials belong in arguments or project files.`;
const OPTIONS = { help: { type: 'boolean' }, apply: { type: 'boolean' }, 'dry-run': { type: 'boolean' },
  json: { type: 'boolean' }, agents: { type: 'string' }, git: { type: 'string' }, sessions: { type: 'boolean' },
  'accept-data-processing': { type: 'boolean' }, python: { type: 'string' }, file: { type: 'string', multiple: true },
  plan: { type: 'string' }, pr: { type: 'string' }, provider: { type: 'string' }, model: { type: 'string' },
  'base-url': { type: 'string' }, 'auth-home': { type: 'string' }, client: { type: 'string' }, agent: { type: 'string' }, root: { type: 'string' },
  query: { type: 'string' }, live: { type: 'boolean' } } as const;
const installOptions = ['agents', 'git', 'sessions', 'accept-data-processing', 'python', 'provider', 'model', 'base-url', 'auth-home'];
const ALLOWED: Record<string, string[]> = { setup: installOptions, install: installOptions,
  configure: ['provider', 'model', 'base-url', 'auth-home'], providers: [], status: [], doctor: ['live'],
  connect: ['client', 'plan'], disconnect: ['client', 'plan'], tools: ['agent', 'live'],
  start: [], stop: [], disable: [], seed: ['file', 'plan'], 'pr-context': ['pr'], mcp: ['agent'],
  recall: ['query'], reflect: ['query'] };
const print = (value: unknown) => console.log(JSON.stringify(value, null, 2));
function projectDefaults(root: string) {
  const source = readText(join(root, 'design/project.json'));
  if (source === null) return null;
  try {
    const input = JSON.parse(source) as { tooling?: unknown };
    const defaults = hindsightOptions(input.tooling);
    return defaults.enabled ? defaults : null;
  } catch {
    throw new MemoryError('PROJECT_MEMORY_CONFIG_INVALID', 'Project Hindsight defaults are invalid; no user configuration was changed.');
  }
}
function storedProvider(p: Paths): ProviderSettings | null {
  const stored = readConfig(join(p.state, 'provider.json'));
  return stored.original === null ? null : providerSettings(stored.data);
}
function persistProvider(p: Paths, settings: ProviderSettings): void {
  const path = join(p.state, 'provider.json'); const before = readConfig(path);
  if (isDeepStrictEqual(before.data, settings)) return;
  if (existsSync(p.python)) requireThat(backend(p, 'probe').running === false, 'PROFILE_RUNNING', 'Run memory stop --apply before changing the shared profile provider.');
  saveConfig(path, { ...settings }, before.original);
}
function diagnostic(repo: Identity, p: Paths, live: boolean): JsonObject {
  const config = readConfig(p.config).data; let code = 'NOT_ENABLED'; let enabled = false;
  try { requireEnabled(config, repo); enabled = true; code = 'ENABLED'; }
  catch (error) { if (error instanceof MemoryError) code = error.code; else throw error; }
  const choice = storedProvider(p);
  const result: JsonObject = { schemaVersion: 1, code, enabled, bank: repo.bank,
    pythonEnvironmentPresent: existsSync(p.python), agentRuntimePresent: existsSync(p.installer),
    provider: choice ? providerPlan(choice) : { provider: 'unconfigured', next: 'Run memory providers, then configure.' },
    desktop: ['claude-code', 'codex'].map(client => connectionStatus(repo, p, desktopClient(client))),
    codexAuthFilePresent: choice?.provider === 'openai-codex' ? existsSync(join(choice.authHome || process.env.CODEX_HOME || join(p.home, '.codex'), 'auth.json')) : null,
    daemonProbed: false, inferenceVerified: false, authenticationVerified: false,
    next: 'Run memory doctor --live, then memory tools --agent codex --live. Restart clients after configuration changes.' };
  if (live && existsSync(p.python)) { result.daemon = backend(p, 'probe'); result.daemonProbed = true; }
  return result;
}
async function dispatch(args: string[]): Promise<number> {
  const { values, positionals, tokens } = parseArgs({ args, options: OPTIONS, allowPositionals: true, strict: true, tokens: true });
  const seen = new Set<string>();
  for (const token of tokens) if (token.kind === 'option' && token.name !== 'file') {
    requireThat(!seen.has(token.name), 'FLAGS_INVALID', 'Duplicate options are not accepted.'); seen.add(token.name);
  }
  if (values.help || positionals.length === 0 || (positionals.length === 1 && positionals[0] === 'help')) {
    if (values.json) print({ schemaVersion: 1, help: HELP }); else console.log(HELP); return 0;
  }
  const command = positionals[0]!;
  requireThat(positionals.length === 1 && Object.hasOwn(ALLOWED, command), 'COMMAND_INVALID', 'Unknown command. Run memory --help.');
  requireThat(!(values.apply && values['dry-run']), 'FLAGS_INVALID', '--apply and --dry-run cannot be combined.');
  for (const key of Object.keys(values)) requireThat(['json', 'apply', 'dry-run', 'root'].includes(key) || ALLOWED[command]!.includes(key), 'FLAGS_INVALID', 'An option does not belong to this command. Run memory --help.');
  requireThat(!['status', 'doctor', 'providers', 'pr-context', 'tools', 'mcp'].includes(command) || !values.apply, 'FLAGS_INVALID', 'This command does not accept --apply.');
  requireThat(!values['dry-run'] || (!values.live && command !== 'mcp'), 'FLAGS_INVALID', '--dry-run cannot start a live probe or MCP session.');
  if (command === 'providers') { print({ schemaVersion: 1, providers: PROVIDERS }); return 0; }
  const p = paths();
  requireThat(!process.env.HINDSIGHT_CONFIG || resolve(process.env.HINDSIGHT_CONFIG) === resolve(p.config), 'CONFIG_CONFLICT', 'A custom HINDSIGHT_CONFIG is active. Reconcile it before changing user-scope hooks.');
  const repo = repository(values.root ?? process.cwd());
  if (command === 'status' || command === 'doctor') { print(diagnostic(repo, p, Boolean(values.live))); return 0; }
  if (command === 'pr-context') { print(pullRequestContext(repo, values.pr ?? '')); return 0; }
  if (command === 'mcp') return launchMcp(repo, p, values.agent ?? '');
  if (command === 'tools') {
    requireThat(['claude-code', 'codex'].includes(values.agent ?? ''), 'AGENT_REQUIRED', 'Choose --agent claude-code or codex.');
    if (values.live) print(await discoverTools(repo, p, values.agent!));
    else print({ operation: command, agent: values.agent, live: false, next: 'Add --live for read-only MCP discovery. No tools are invoked and no daemon is started.' });
    return 0;
  }
  if (command === 'connect' || command === 'disconnect') {
    if (command === 'connect') { requireEnabled(readConfig(p.config).data, repo); nativeServer(p); }
    const client = desktopClient(values.client ?? '');
    const change = connection(repo, p, client, command === 'disconnect');
    if (!values.apply) print(change.plan);
    else print(locked(p.state, () => {
      requireThat(!values.plan || values.plan === change.plan.planHash, 'PLAN_CHANGED', 'Desktop configuration changed; review a fresh connection plan.');
      applyConnection(change); return { ok: true, code: command.toUpperCase(), client, next: 'Restart the desktop app. Client trust and tool approval remain under your control.' };
    }));
    return 0;
  }
  checkExisting(readConfig(p.config).data);
  if (['setup', 'install', 'configure'].includes(command)) {
    requireThat(values.provider || (!values.model && !values['base-url'] && !values['auth-home']), 'PROVIDER_REQUIRED', '--model and --base-url require an explicit --provider.');
    const chosen = values.provider ? providerSettings({ schemaVersion: 1, provider: values.provider,
      ...(values.model ? { model: values.model } : {}), ...(values['base-url'] ? { baseUrl: values['base-url'] } : {}), ...(values['auth-home'] ? { authHome: values['auth-home'] } : {}) }) : storedProvider(p);
    if (command === 'configure') {
      requireThat(chosen, 'PROVIDER_REQUIRED', 'Choose --provider NAME. Run memory providers.');
      if (!values.apply) print(providerPlan(chosen)); else print(locked(p.state, () => {
        persistProvider(p, chosen); return { ok: true, code: 'CONFIGURED', ...providerPlan(chosen) };
      })); return 0;
    }
    const defaults = projectDefaults(repo.root);
    const choice = consent(values.agents ?? defaults?.agents.join(',') ?? '', values.git ?? defaults?.git ?? 'message',
      values.sessions === undefined ? Boolean(defaults?.sessions) : Boolean(values.sessions));
    if (!values.apply) {
      print({ ...installationPlan(repo, p, choice), projectDefaults: defaults ? { source: 'design/project.json', ...defaults } : null,
        provider: chosen ? providerPlan(chosen) : 'Choose --provider; no API key is required for keyless modes.',
        desktopConnections: command === 'setup' ? choice.agents.filter(a => ['claude-code', 'codex'].includes(a)) : [],
        next: 'Review provider prerequisites, then repeat with --apply --accept-data-processing.' }); return 0;
    }
    requireThat(values['accept-data-processing'], 'CONSENT_REQUIRED', 'Review the plan and explicitly add --accept-data-processing.');
    const selected = chosen ?? (process.env.HINDSIGHT_API_LLM_PROVIDER ? providerSettings({ schemaVersion: 1, provider: 'environment' }) : null);
    requireThat(selected, 'PROVIDER_REQUIRED', 'Choose --provider. Use none without a model, or an authenticated/local-model provider without an API key.');
    requireThat(!(process.platform === 'darwin' && process.arch === 'x64'), 'PLATFORM_UNSUPPORTED', 'Full installation on Intel macOS is not supported; see HINDSIGHT.md.');
    [p.venv, p.runtime, p.config].forEach(noSymlink);
    const result = locked(p.state, () => {
      persistProvider(p, selected);
      const installed = install(repo, p, choice, values.python ?? (process.platform === 'win32' ? 'python' : 'python3'), {
        execute: (cmd, argv) => { run(cmd, argv, { timeout: 1200000 }); },
        npm: argv => { const cmd = npmCommand(argv); run(cmd.command, cmd.args, { timeout: 1200000 }); },
        backend: cmd => backend(p, cmd, { approved: true }), read: () => readConfig(p.config),
        save: (data, original) => saveConfig(p.config, data, original), pythonExists: () => existsSync(p.python),
        announce: stage => console.error(`[hindsight] ${stage}`),
      });
      if (command === 'setup') for (const agent of choice.agents.filter(a => ['claude-code', 'codex'].includes(a))) applyConnection(connection(repo, p, desktopClient(agent)));
      return { ...installed, provider: selected.provider, next: 'Restart selected clients, approve the MCP connection, then run memory doctor --live and memory tools --agent codex --live. Inference has not been verified.' };
    }); print(result); return 0;
  }
  if (command === 'seed') {
    const docs = committedDocuments(repo, values.file ?? []); const plan = seedPlan(repo, docs);
    if (!values.apply) print(plan);
    else {
      requireThat(values.plan === plan.planHash, 'PLAN_CHANGED', 'Supply the exact reviewed --plan hash; HEAD or content may have changed.');
      print(locked(p.state, () => backend(p, 'retain', { url: requireEnabled(readConfig(p.config).data, repo), bank: repo.bank, documents: docs, approved: true })));
    }
    return 0;
  }
  if (command === 'recall' || command === 'reflect') {
    requireThat(typeof values.query === 'string' && values.query.trim().length > 0 && values.query.length <= 4096 && !values.query.includes('\0'), 'QUERY_INVALID', 'Supply a nonempty --query of at most 4096 characters. Do not include secrets.');
    if (!values.apply) print({ operation: command, bank: repo.bank, apply: false, next: 'Add --apply to send this query to the approved memory service/provider. Results are untrusted source data.' });
    else print(locked(p.state, () => backend(p, command, { url: requireEnabled(readConfig(p.config).data, repo), bank: repo.bank, query: values.query, approved: true })));
    return 0;
  }
  if (!values.apply) {
    print({ schemaVersion: 1, operation: command, bank: repo.bank, apply: false, warning: command === 'stop' ? 'Stops the shared local profile for all opted-in projects. Data is retained.' : 'Add --apply to execute. Disable fully takes effect after client restart.' }); return 0;
  }
  print(locked(p.state, () => {
    const current = readConfig(p.config);
    if (command === 'disable') {
      requireEnabled(current.data, repo); saveConfig(p.config, disabled(current.data, repo), current.original);
      return { ok: true, code: 'DISABLED', bank: repo.bank, next: 'Restart clients. Data, provider and user hooks are preserved.' };
    }
    const url = command === 'stop' ? configuredEndpoint(current.data, repo) : requireEnabled(current.data, repo);
    return backend(p, command, { url, approved: true });
  })); return 0;
}
export async function main(args = process.argv.slice(2)): Promise<number> {
  try { return await dispatch(args); }
  catch (error) {
    const safe = error instanceof MemoryError ? error : new MemoryError('COMMAND_FAILED', 'Command failed. Run memory doctor and consult HINDSIGHT.md. Existing data was not automatically deleted; raw errors are withheld.');
    const receipt = JSON.stringify({ ok: false, code: safe.code, message: safe.message });
    if (args.includes('--json') && args[0] !== 'mcp') console.log(receipt); else console.error(receipt);
    return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = await main();
