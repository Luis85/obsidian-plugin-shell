import type { CommandGroup } from './command-definitions';
import type { EventPort, ShellEvents } from './events';
import type { ModalService } from './modal-service';
import type { NoticeService } from './notice-service';
import type { PreferenceService } from './preference-service';
import type { ErrorReporter } from './ports';
import { BooleanSetting } from './boolean-setting';

/** Framework-free capabilities; each factory owns its subscriptions and dialogs. */
export interface AuthoringServices {
  readonly events: EventPort<ShellEvents>;
  readonly modals: Pick<ModalService, 'info' | 'confirm' | 'prompt' | 'closeOwner'>;
  readonly notices: Pick<NoticeService, 'info' | 'dismissOwner'>;
  readonly preferences: Pick<PreferenceService, 'current' | 'readonly' | 'update' | 'toggleViewHeader' | 'subscribe'>;
  readonly diagnostics: ErrorReporter;
}
export interface AuthoringExtension extends CommandGroup { readonly settings?: readonly BooleanSetting[]; dispose(): void }
export type AuthoringFactory<T extends AuthoringServices = AuthoringServices> = (services: T) => AuthoringExtension;
function owned(value: unknown): value is { dispose(): void } {
  return value !== null && typeof value === 'object' && 'dispose' in value && typeof value.dispose === 'function';
}
function thenable(value: unknown): value is PromiseLike<unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function') && 'then' in value && typeof value.then === 'function';
}
function valid(value: unknown): value is AuthoringExtension {
  return owned(value) && 'commands' in value && Array.isArray(value.commands) && (!('ribbons' in value) || value.ribbons === undefined || Array.isArray(value.ribbons))
    && (!('settings' in value) || value.settings === undefined || (Array.isArray(value.settings) && value.settings.every(setting => setting instanceof BooleanSetting)));
}

export function createAuthoringRuntime<T extends AuthoringServices>(factories: readonly AuthoringFactory<T>[], services: T) {
  const extensions: AuthoringExtension[] = []; const owners: { dispose(): void }[] = [];
  const release = (owner: { dispose(): void }) => {
    try { owner.dispose(); } catch { services.diagnostics.report('authoring.cleanup', 'runtime.dispose'); }
  };
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const owner of Array.from(owners).reverse()) release(owner);
  };
  try {
    for (const factory of factories) {
      const extension: unknown = factory(services);
      if (thenable(extension)) {
        void Promise.resolve(extension).then(value => { if (owned(value)) release(value); }, () => services.diagnostics.report('authoring.factory', 'runtime.initialize'));
        throw new Error('AUTHORING_ASYNC_FACTORY');
      }
      if (owned(extension)) owners.push(extension);
      if (!valid(extension)) throw new Error('AUTHORING_INVALID_EXTENSION');
      owners.push(...extension.settings ?? []);
      extensions.push(extension);
    }
    const groups = extensions.map(({ commands, ribbons }) => ({ commands, ...(ribbons ? { ribbons } : {}) }));
    const settings = Object.freeze(extensions.flatMap(extension => extension.settings ?? []));
    if (settings.length > 100 || new Set(settings.map(setting => setting.definition.id)).size !== settings.length) throw new Error('AUTHORING_SETTING_CATALOG');
    return { groups, settings, async initialize() { for (const setting of settings) { if (disposed) return; await setting.initialize(); } }, dispose };
  } catch (error) { dispose(); throw error; }
}
