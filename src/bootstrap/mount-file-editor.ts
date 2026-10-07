import type { Component } from 'vue';
import NativeFileEditorHost from '../presentation/components/NativeFileEditorHost.vue';
import { createNativeFileModel, nativeFileKey } from '../presentation/context/native-file-context';
import type { MountNativeFileEditor } from '../infrastructure/obsidian/custom-file-view';
import type { NativeFileEditorMounts } from '../infrastructure/obsidian/native-integrations';
import type { Services } from './services';
import { mountVueSurface } from './vue-surface';

/** A Vue editor for one registered file type (`id` is the file type's id). */
export interface NativeFileEditorRegistration {
  readonly id: string;
  readonly component: Component;
}
export function mountFileEditor(services: Services, editor: Component): MountNativeFileEditor {
  return (root, session) => {
    const { model, release } = createNativeFileModel(session);
    return mountVueSurface(root, services, {
      component: NativeFileEditorHost,
      props: portalRoot => ({ portalRoot, editor }),
      provide: app => app.provide(nativeFileKey, model),
      releases: [release],
    });
  };
}
/** Explicit registrations only; a duplicate file type id is a wiring error. */
export function nativeFileEditorMounts(services: Services, registrations: readonly NativeFileEditorRegistration[]): NativeFileEditorMounts {
  const mounts = new Map<string, MountNativeFileEditor>();
  for (const registration of registrations) {
    if (mounts.has(registration.id)) throw new Error('NATIVE_EDITOR_DUPLICATE');
    mounts.set(registration.id, mountFileEditor(services, registration.component));
  }
  return mounts;
}
