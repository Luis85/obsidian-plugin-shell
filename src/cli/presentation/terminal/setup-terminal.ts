import type { Context, Request, Result } from '../../adapters/framework/contracts.ts';
import { setupDefaults, type SetupTerminalDependencies } from '../wizards/framework-setup.ts';
import { startWizard } from '../wizards/registry.ts';
type Prompt = (message: string) => Promise<string>;
type Write = (message: string) => void;
type Execute = (request: Request, context: Context) => Promise<Result>;
type Render = (value: Result) => void;
/** Terminal-only interview defined by configs/wizards/framework-setup.json. Headless/API callers use explicit source/identity arguments. */
export async function guidedSetup(request: Request, context: Context, prompt: Prompt, write: Write, dependencies: SetupTerminalDependencies = setupDefaults): Promise<Request> {
  const state = { setup: { ...request.options } };
  await startWizard({ ask: prompt, write }, 'framework-setup', { ...context, dependencies, prompt }, state);
  return { ...request, options: state.setup };
}
/** configs/wizards/framework-setup-stages.json: each effect needs a separate approval; returning early retains completed state for setup resume. */
export async function continueSetup(context: Context, execute: Execute, prompt: Prompt, render: Render, configured: Result, dependencies: SetupTerminalDependencies = setupDefaults): Promise<Result> {
  const state: { outcome: Result } = { outcome: configured };
  await startWizard({ ask: prompt, write: () => {} }, 'framework-setup-stages', { ...context, dependencies, execute, prompt, render }, state);
  return state.outcome;
}
