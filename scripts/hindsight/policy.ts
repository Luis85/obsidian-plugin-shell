/** Pure project-memory policy. Importing this module has no I/O or side effects. */
import { sha256 } from '../shared/hash.mjs';
export const PYTHON_VERSION = '0.10.1';
export const AGENT_VERSION = '0.7.0';
export const PROFILE = 'obsidian-shell';
const AGENTS = ['claude-code', 'codex', 'cursor-cli', 'copilot-cli', 'opencode'] as const;
export type Agent = typeof AGENTS[number];
export type JsonObject = Record<string, unknown>;
export type GitMode = 'none' | 'message' | 'full';
export interface Identity { root: string; canonical: string; bank: string; github?: string; mainRoot?: string }
export interface Consent { agents: Agent[]; git: GitMode; sessions: boolean }
export class MemoryError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}
export function requireThat(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) throw new MemoryError(code, message);
}
export function object(value: unknown): JsonObject {
  requireThat(value !== null && typeof value === 'object' && !Array.isArray(value), 'CONFIG_INVALID', 'Expected a JSON object; existing configuration was not changed.');
  const result = value as JsonObject;
  for (const [key, child] of Object.entries(result)) {
    requireThat(!['__proto__', 'prototype', 'constructor'].includes(key), 'CONFIG_INVALID', 'Unsafe JSON key.');
    if (child && typeof child === 'object') {
      if (Array.isArray(child)) child.forEach(item => { if (item && typeof item === 'object') object(item); });
      else object(child);
    }
  }
  return result;
}
export function digest(text: string): string { return sha256(text); }
export function identity(root: string, commonDir: string, remote: string): Identity {
  const match = /^(?:https:\/\/(?:[^/@]+@)?github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i.exec(remote);
  const github = match ? `${match[1]}/${match[2]}`.toLowerCase() : undefined;
  const canonical = github ? `github.com/${github}` : `local:${commonDir}`;
  return { root, canonical, bank: `shell-${digest(canonical).slice(0, 24)}`, ...(github ? { github } : {}) };
}
export function loopback(value: unknown): string {
  requireThat(typeof value === 'string', 'ENDPOINT_INVALID', 'Expected a loopback endpoint.');
  let url: URL;
  try { url = new URL(value); } catch { throw new MemoryError('ENDPOINT_INVALID', 'Invalid local endpoint.'); }
  requireThat(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && !url.username && !url.password && !url.search && !url.hash && url.pathname === '/', 'ENDPOINT_INVALID', 'Only credential-free HTTP loopback endpoints are supported by this local integration.');
  return url.origin;
}
export function consent(agents: string, git: string, sessions: boolean): Consent {
  const selected = [...new Set(agents.split(',').filter(Boolean))];
  requireThat(selected.length > 0 && selected.every(a => AGENTS.some(allowed => a === allowed)), 'AGENT_REQUIRED', `Choose explicit agents: ${AGENTS.join(', ')}. No implicit install-all.`);
  requireThat(['none', 'message', 'full'].includes(git), 'GIT_MODE_INVALID', 'Git mode must be none, message, or full.');
  return { agents: selected as Agent[], git: git as GitMode, sessions };
}
const OVERRIDES = ['apiUrl', 'apiToken', 'serverMode', 'optInOnly', 'optInPaths', 'mapPathToBank', 'bankId', 'dynamicBankId', 'bankIdTemplate', 'banks', 'autoUpdate'];
export function checkExisting(config: JsonObject, endpoint?: string): void {
  if (Object.keys(config).length === 0) return;
  requireThat(config.optInOnly === true && config.autoUpdate === false && config.serverMode === 'self-hosted', 'CONFIG_CONFLICT', 'Existing Hindsight configuration is not opt-in, pinned, self-hosted configuration. Reconcile it manually; nothing was overwritten.');
  const current = loopback(config.apiUrl);
  if (endpoint) requireThat(current === loopback(endpoint), 'ENDPOINT_CONFLICT', 'A different Hindsight endpoint is configured. Stop and reconcile manually.');
  requireThat(!config.apiToken, 'CONFIG_CONFLICT', 'Authenticated existing servers need a separately reviewed connection.');
  requireThat(!config.bankId && config.dynamicBankId !== false, 'CONFIG_CONFLICT', 'Static bank routing is not supported.');
  requireThat(!config.optInPaths || (Array.isArray(config.optInPaths) && config.optInPaths.length === 0), 'CONFIG_CONFLICT', 'Broad optInPaths require manual review.');
  for (const section of Object.values(object(config.harnesses ?? {}))) {
    requireThat(!OVERRIDES.some(key => Object.hasOwn(object(section), key)), 'CONFIG_CONFLICT', 'Harness endpoint or privacy overrides require manual review.');
  }
  requireThat(Object.values(object(config.mapPathToBank ?? {})).every(v => typeof v === 'string'), 'CONFIG_INVALID', 'Invalid path-to-bank mapping.');
  object(config.banks ?? {});
}
export function configured(config: JsonObject, repo: Identity, endpoint: string, choice: Consent): JsonObject {
  checkExisting(config, endpoint);
  const maps = object(config.mapPathToBank ?? {});
  requireThat(!maps[repo.root] || maps[repo.root] === repo.bank, 'BANK_CONFLICT', 'This checkout already maps to another bank.');
  const banks = object(config.banks ?? {}); const previous = object(banks[repo.bank] ?? {});
  requireThat(!previous.bank && !OVERRIDES.some(key => Object.hasOwn(previous, key)), 'BANK_CONFLICT', 'This bank has endpoint/routing overrides.');
  return { gitIngest: 'none', retainSessions: false, codebaseSurvey: false, ...config, apiToken: '', apiUrl: loopback(endpoint), serverMode: 'self-hosted', optInOnly: true, optInPaths: [], autoUpdate: false,
    mapPathToBank: { ...maps, [repo.root]: repo.bank }, banks: { ...banks, [repo.bank]: { ...previous, disabled: false, gitIngest: choice.git, retainSessions: choice.sessions, codebaseSurvey: false, seedLimit: 100, pageTriggerType: 'manual' } } };
}
export function disabled(config: JsonObject, repo: Identity): JsonObject {
  checkExisting(config); requireThat(Object.keys(config).length > 0, 'NOT_ENABLED', 'No memory configuration exists.');
  const banks = object(config.banks ?? {});
  return { ...config, banks: { ...banks, [repo.bank]: { ...object(banks[repo.bank] ?? {}), disabled: true } } };
}
export function configuredEndpoint(config: JsonObject, repo: Identity): string {
  checkExisting(config); const maps = object(config.mapPathToBank ?? {});
  requireThat(maps[repo.root] === repo.bank || (repo.mainRoot && maps[repo.mainRoot] === repo.bank), 'NOT_ENABLED', 'Run install explicitly in this checkout first.');
  const bank = object(object(config.banks ?? {})[repo.bank] ?? {});
  requireThat(!bank.bank && !OVERRIDES.some(key => Object.hasOwn(bank, key)), 'BANK_CONFLICT', 'This bank contains routing/endpoint overrides.');
  return loopback(config.apiUrl);
}
export function requireEnabled(config: JsonObject, repo: Identity): string {
  const endpoint = configuredEndpoint(config, repo);
  requireThat(config.disabled !== true && object(object(config.banks ?? {})[repo.bank] ?? {}).disabled === false, 'NOT_ENABLED', 'Memory is disabled for this repository.');
  return endpoint;
}
export interface Document { path: string; content: string; sha256: string; documentId: string; commit: string }
export function document(repo: Identity, path: string, content: string, commit: string): Document {
  requireThat(/^docs\/memory\/(?:[a-z0-9][a-z0-9-]*\/)*[a-z0-9][a-z0-9-]*\.md$/.test(path), 'SOURCE_DENIED', 'Only explicitly selected committed docs/memory/*.md documents are eligible.');
  requireThat(content.trim().length > 0 && Buffer.byteLength(content) <= 65536 && !content.includes('\0'), 'SOURCE_INVALID', 'Memory documents must be nonempty UTF-8 Markdown, at most 64 KiB.');
  requireThat(!/-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,})/.test(content), 'SECRET_DETECTED', 'A likely credential was detected. Remove it and review the whole document; detection is not exhaustive.');
  return { path, content, sha256: digest(content), documentId: `curated:${repo.bank}:${path}`, commit };
}
export function seedPlan(repo: Identity, docs: Document[]): JsonObject {
  const sources = docs.map(({ content: _content, ...source }) => source);
  const plan = { schemaVersion: 1, bank: repo.bank, sources };
  return { ...plan, planHash: digest(JSON.stringify(plan)), warning: 'Review the committed source text before applying. Extraction may call your configured LLM provider.' };
}
