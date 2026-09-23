import { reactive, ref, watch, useId, onScopeDispose } from 'vue';
import type { Preferences } from '../../domain/preferences';
import { useServices } from '../context/use-services';
import { useViewPreferences } from './use-view-preferences';

export function useSettingsForm() {
  const uid = useId();
  const services = useServices();
  const model = useViewPreferences();
  const form = reactive({ ...model.preferences.value });
  const base = reactive({ ...model.preferences.value });
  const pending = ref(false);
  const headerPending = ref(false);
  const error = ref('');
  let alive = true;
  onScopeDispose(() => { alive = false; });
  // Merge external commits into clean fields only. Another leaf must not erase a draft.
  watch(model.preferences, value => {
    if (form.locale === base.locale) form.locale = value.locale;
    if (form.taskFolder === base.taskFolder) form.taskFolder = value.taskFolder;
    if (form.notifySuccess === base.notifySuccess) form.notifySuccess = value.notifySuccess;
    Object.assign(base, value);
  });
  async function save() {
    if (pending.value || services.preferences.readonly) return;
    pending.value = true; error.value = '';
    const patch: Partial<Preferences> = {
      ...(form.locale !== base.locale ? { locale: form.locale } : {}),
      ...(form.taskFolder !== base.taskFolder ? { taskFolder: form.taskFolder } : {}),
      ...(form.notifySuccess !== base.notifySuccess ? { notifySuccess: form.notifySuccess } : {}),
    };
    try {
      const result = await services.preferences.update(patch);
      if (!alive) return;
      if (result.ok) services.notifications.show(`${model.owner}:settings`, 'success', 'settings.saved');
      else error.value = result.error.key;
    } catch { if (alive) error.value = 'error.unexpected'; services.diagnostics.report('settings.unexpected', 'settings.save'); }
    finally { if (alive) pending.value = false; }
  }
  async function toggleHeader(event: Event) {
    if (headerPending.value || services.preferences.readonly) return;
    const target = event.currentTarget;
    if (!target || !('checked' in target) || typeof target.checked !== 'boolean') return;
    const requested = target.checked;
    // Controlled value: do not display a successful change before persistence succeeds.
    target.checked = model.preferences.value.hideObsidianViewHeader;
    headerPending.value = true; error.value = '';
    try {
      const result = await services.preferences.update({ hideObsidianViewHeader: requested });
      if (alive && !result.ok) error.value = result.error.key;
    } catch { if (alive) error.value = 'error.unexpected'; services.diagnostics.report('settings.unexpected', 'settings.save'); }
    finally { if (alive) headerPending.value = false; }
  }
  return { uid, services, preferences: model.preferences, form, pending, headerPending, error, save, toggleHeader };
}
