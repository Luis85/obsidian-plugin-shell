/** Installation use case; previews never invoke a port. */
import { isDeepStrictEqual } from 'node:util';
import { join } from 'node:path';
import { PYTHON_VERSION, AGENT_VERSION, PROFILE, checkExisting, configured, disabled, loopback, requireThat, type Consent, type Identity, type JsonObject } from './policy.ts';
import type { Paths } from './io.ts';
export interface InstallPort {
  execute(command: string, args: string[]): void;
  npm(args: string[]): void;
  backend(command: string): JsonObject;
  read(): { data: JsonObject; original: string | null };
  save(data: JsonObject, expected: string | null): void;
  pythonExists(): boolean;
  announce(stage: string): void;
}
export function installationPlan(repo: Identity, p: Paths, choice: Consent): JsonObject {
  return { schemaVersion: 1, operation: 'install', profile: PROFILE, repository: repo.canonical, bank: repo.bank,
    packages: [`hindsight-all==${PYTHON_VERSION}`, `hindsight-client==${PYTHON_VERSION}`, `@vectorize-io/hindsight-coding-agents@${AGENT_VERSION}`], agents: choice.agents,
    pythonEnvironment: p.venv, runtime: p.runtime, userConfig: p.config,
    privacy: { optInOnly: true, gitIngest: choice.git, retainSessions: choice.sessions, codebaseSurvey: false, seedLimit: 100, pageTriggerType: 'manual', autoUpdate: false },
    effects: ['Download optional dependencies and possibly models; start a persistent local Python daemon.',
      'Merge official hooks/MCP/skill into selected agents\' USER configuration; no global npm install.',
      'Approved Git history and prompts may reach the configured LLM provider. Keyless does not mean unlimited or offline.',
      'Root-path opt-in includes descendants and inherited worktrees. Do not approve parents of unrelated projects.'],
    approval: 'Preview only. Add --apply --accept-data-processing after review.' };
}
export function install(repo: Identity, p: Paths, choice: Consent, python: string, port: InstallPort): JsonObject {
  const before = port.read(); checkExisting(before.data);
  requireThat(before.data.disabled !== true, 'NOT_ENABLED', 'Global memory is disabled. Review that user setting before installing; it was not overridden.');
  port.announce('Checking Python (3.11+) and installing isolated optional packages');
  port.execute(python, ['-c', 'import sys; assert sys.version_info >= (3, 11), "Python 3.11+ is required"']);
  if (!port.pythonExists()) port.execute(python, ['-m', 'venv', p.venv]);
  port.execute(p.python, ['-m', 'pip', 'install', '--disable-pip-version-check', `hindsight-all==${PYTHON_VERSION}`, `hindsight-client==${PYTHON_VERSION}`]);
  port.npm(['install', '--prefix', p.runtime, '--save-exact', '--ignore-scripts', '--no-audit', '--no-fund', `@vectorize-io/hindsight-coding-agents@${AGENT_VERSION}`]);
  port.announce('Starting the Python embedded profile (no UI or content import)');
  const endpoint = loopback(port.backend('start').url);
  const approved = configured(before.data, repo, endpoint, choice); const staged = disabled(approved, repo);
  port.save(staged, before.original);
  port.announce('Installing official native agent hooks with the bank still disabled');
  port.execute(process.execPath, [p.installer, 'install', ...choice.agents, '--server', 'self-hosted', '--api-url', endpoint]);
  const after = port.read();
  requireThat(isDeepStrictEqual(after.data, staged), 'CONFIG_CHANGED', 'The native installer changed memory configuration. Review before enabling; no external edit was overwritten.');
  port.save(approved, after.original);
  return { ok: true, code: 'INSTALLED', bank: repo.bank, endpoint, agents: choice.agents, packageLock: join(p.runtime, 'package-lock.json'), next: 'Restart agents. Run memory doctor and tools --agent codex --live. Configure desktop autostart with memory connect.' };
}
