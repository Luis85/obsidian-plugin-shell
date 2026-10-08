/** Non-secret inference settings. An agent's MCP connection is not an LLM provider. */
import { isAbsolute } from 'node:path';
import { object, requireThat, type JsonObject } from './policy.ts';
export const PROVIDERS = {
  'openai-codex': { key: false, model: false, prerequisite: 'Codex login with file-backed OAuth credentials accessible to the daemon; desktop login alone is not proof.', inference: 'Account-authenticated; usage and eligibility depend on the account.' },
  'claude-code': { key: false, model: false, prerequisite: 'Claude Code CLI and authenticated Claude Agent SDK; review upstream personal-use restrictions.', inference: 'Account-authenticated, not offline or unlimited.' },
  ollama: { key: false, model: true, prerequisite: 'A running local Ollama server and an already downloaded model.', inference: 'Local inference; model downloads and hardware are still required.' },
  lmstudio: { key: false, model: true, prerequisite: 'A loaded local LM Studio model and enabled local server.', inference: 'Local inference; model downloads and hardware are still required.' },
  none: { key: false, model: false, prerequisite: 'Local embeddings/reranker models; no generative model or login.', inference: 'Chunks + recall only. Reflect, extracted facts and synthesized pages are unavailable.' },
  environment: { key: true, model: false, prerequisite: 'Explicit HINDSIGHT_API_LLM_PROVIDER/MODEL in the daemon environment/profile.', inference: 'Legacy advanced setup. Key requirement depends on the chosen provider.' },
} as const;
export type ProviderName = keyof typeof PROVIDERS;
export interface ProviderSettings { schemaVersion: 1; provider: ProviderName; model?: string; baseUrl?: string; authHome?: string }
export function providerSettings(value: unknown): ProviderSettings {
  const input = object(value);
  requireThat(Object.keys(input).every(k => ['schemaVersion', 'provider', 'model', 'baseUrl', 'authHome'].includes(k)), 'PROVIDER_INVALID', 'Provider settings cannot contain credentials or unknown fields.');
  requireThat(input.schemaVersion === 1 && typeof input.provider === 'string' && Object.hasOwn(PROVIDERS, input.provider), 'PROVIDER_REQUIRED', 'Choose a provider with memory configure --provider NAME. Run memory providers.');
  const name = input.provider as ProviderName;
  const model = input.model;
  requireThat(model === undefined || (typeof model === 'string' && model.length > 0 && model.length <= 160 && /^[\w./:@+-]+$/.test(model)), 'MODEL_INVALID', 'Use a model identifier, not credentials, whitespace or a command.');
  requireThat(!PROVIDERS[name].model || Boolean(model), 'MODEL_REQUIRED', 'A local provider needs --model matching an already loaded/downloaded model.');
  requireThat(!['none', 'environment'].includes(name) || model === undefined, 'MODEL_INVALID', 'No-LLM/environment mode does not accept a model option.');
  const result: ProviderSettings = { schemaVersion: 1, provider: name, ...(model ? { model: String(model) } : {}) };
  if (input.baseUrl !== undefined) {
    requireThat(['ollama', 'lmstudio'].includes(name) && typeof input.baseUrl === 'string', 'PROVIDER_INVALID', 'A custom base URL is supported only for the local providers.');
    let url: URL;
    try { url = new URL(String(input.baseUrl)); } catch { throw new Error('Invalid local model URL'); }
    requireThat(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && !url.username && !url.password && !url.search && !url.hash && /^\/(?:v1\/?)?$/.test(url.pathname), 'ENDPOINT_INVALID', 'Local model endpoints must be credential-free HTTP loopback URLs, optionally ending in /v1.');
    result.baseUrl = url.href.replace(/\/$/, '');
  }
  if (input.authHome !== undefined) {
    requireThat(name === 'openai-codex' && typeof input.authHome === 'string' && isAbsolute(input.authHome) && input.authHome.length <= 1024 && !/[\x00-\x1f]/.test(input.authHome), 'AUTH_HOME_INVALID', 'Only openai-codex accepts an absolute, non-secret --auth-home directory.');
    result.authHome = input.authHome;
  }
  return result;
}
export function providerPlan(settings: ProviderSettings): JsonObject {
  return { ...settings, ...PROVIDERS[settings.provider], scope: 'Shared local obsidian-shell profile; affects every bank on that profile.',
    secretsPersisted: false, next: 'Stop the profile before changing provider. Configuration writes do not log in, download models or start inference.' };
}
