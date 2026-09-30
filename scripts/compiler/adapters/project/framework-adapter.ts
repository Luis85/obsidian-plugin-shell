import type { Model } from '../../../companion/compiler/model.ts';
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
export function defineFrameworkAdapter<const T extends FrameworkAdapter>(adapter: T): T {
  if (!adapter || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(adapter.id) || adapter.id.length > 64 || !adapter.label
    || !['none', 'vanilla', 'nuxtui', 'angular'].includes(adapter.engine) || (adapter.files !== undefined && typeof adapter.files !== 'function'))
    throw new Error('FRAMEWORK_ADAPTER_INVALID');
  pins(adapter.dependencies, 'DEPENDENCY');
  pins(adapter.devDependencies, 'DEV_DEPENDENCY');
  return Object.freeze(adapter);
}
