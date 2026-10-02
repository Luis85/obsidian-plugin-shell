import type { Model } from '../../../../scripts/companion/compiler/model.ts';
import type { TemplateSnapshot } from '../../domain/contracts.ts';
import type { ProjectSelection } from '../../domain/project-starter.ts';

export type FrameworkEngine = 'none' | 'vanilla' | 'nuxtui' | 'angular';
export interface FrameworkAdapterContext {
  readonly model: Model;
  readonly template: TemplateSnapshot;
  readonly selection: ProjectSelection;
  readonly projectId: string;
  readonly projectName: string;
}
export interface FrameworkAdapter {
  readonly id: string;
  readonly label: string;
  /**
   * Reuse one qualified build/runtime engine, then contribute framework-specific
   * dependencies and source. React-like Vite frameworks normally use vanilla.
   */
  readonly engine: FrameworkEngine;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  files?(context: FrameworkAdapterContext): Readonly<Record<string, string>>;
}
function pins(value: Readonly<Record<string, string>> | undefined, label: string): void {
  for (const [name, version] of Object.entries(value ?? {})) {
    if (!/^[@a-zA-Z0-9][@a-zA-Z0-9._/-]*$/.test(name) || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version))
      throw new Error('FRAMEWORK_ADAPTER_' + label + '_INVALID');
  }
}
const engines: readonly string[] = ['none', 'vanilla', 'nuxtui', 'angular'];
/** Identity, label, engine and optional file contributor are well formed. */
function wellFormed(adapter: FrameworkAdapter | undefined): adapter is FrameworkAdapter {
  if (!adapter || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(adapter.id) || adapter.id.length > 64) return false;
  return Boolean(adapter.label) && engines.includes(adapter.engine) && (adapter.files === undefined || typeof adapter.files === 'function');
}
export function defineFrameworkAdapter<const T extends FrameworkAdapter>(adapter: T): T {
  if (!wellFormed(adapter)) throw new Error('FRAMEWORK_ADAPTER_INVALID');
  pins(adapter.dependencies, 'DEPENDENCY');
  pins(adapter.devDependencies, 'DEV_DEPENDENCY');
  for (const name of Object.keys(adapter.dependencies ?? {})) {
    if (adapter.devDependencies?.[name] !== undefined) throw new Error('FRAMEWORK_ADAPTER_DEPENDENCY_SCOPE_CONFLICT:' + name);
  }
  return Object.freeze(adapter);
}
