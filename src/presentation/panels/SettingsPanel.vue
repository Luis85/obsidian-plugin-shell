<script setup lang="ts">
import { reactive, ref, watch, useId, onScopeDispose } from 'vue';
import { useI18n } from 'vue-i18n';
import UButton from '@nuxt/ui/components/Button.vue';
import UInput from '@nuxt/ui/components/Input.vue';
import UCard from '@nuxt/ui/components/Card.vue';
import type { Preferences } from '../../domain/preferences';
import { useServices } from '../context';
import { useShowcase } from '../stores/showcase';
const { t } = useI18n();
const uid = useId();
const services = useServices();
const model = useShowcase();
const form = reactive({ ...model.preferences });
const base = reactive({ ...model.preferences });
const pending = ref(false);
const headerPending = ref(false);
const error = ref('');
let alive = true;
onScopeDispose(() => { alive = false; });
// Merge external commits into clean fields only. Another leaf must not erase a draft.
watch(() => model.preferences, value => {
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
  target.checked = model.preferences.hideObsidianViewHeader;
  headerPending.value = true; error.value = '';
  try {
    const result = await services.preferences.update({ hideObsidianViewHeader: requested });
    if (alive && !result.ok) error.value = result.error.key;
  } catch { if (alive) error.value = 'error.unexpected'; services.diagnostics.report('settings.unexpected', 'settings.save'); }
  finally { if (alive) headerPending.value = false; }
}
</script>
<template>
  <div class="shell-page-heading"><div class="shell-eyebrow">{{ t('nav.settings') }} · Vue I18n</div><h1>{{ t('settings.title') }}</h1><p>{{ t('settings.subtitle') }}</p></div>
  <p v-if="services.preferences.readonly" role="alert" class="shell-error">{{ t('settings.blocked') }}</p>
  <UCard class="shell-settings-card"><form class="shell-form" @submit.prevent="save">
    <div class="shell-setting-row"><div><label :for="`${uid}-shell-header`">{{ t('settings.hideHeader') }}</label><p :id="`${uid}-shell-header-help`">{{ t('settings.hideHeaderHelp') }}</p></div><input :id="`${uid}-shell-header`" type="checkbox" :checked="model.preferences.hideObsidianViewHeader" :aria-describedby="`${uid}-shell-header-help`" :disabled="headerPending || services.preferences.readonly" @change="toggleHeader"></div>
    <p v-if="headerPending" role="status">{{ t('settings.headerSaving') }}</p>
    <div class="shell-setting-row"><div><label :for="`${uid}-shell-locale`">{{ t('settings.language') }}</label><p>{{ t('settings.languageHelp') }}</p></div><select :id="`${uid}-shell-locale`" v-model="form.locale" :disabled="pending || services.preferences.readonly"><option value="en">English</option><option value="de">Deutsch</option></select></div>
    <div class="shell-setting-row"><div><label :for="`${uid}-shell-folder`">{{ t('settings.folder') }}</label><p>{{ t('settings.folderHelp') }}</p></div><UInput :id="`${uid}-shell-folder`" v-model="form.taskFolder" :disabled="pending || services.preferences.readonly" /></div>
    <div class="shell-setting-row"><div><label :for="`${uid}-shell-notices`">{{ t('settings.notices') }}</label><p>{{ t('settings.noticesHelp') }}</p></div><input :id="`${uid}-shell-notices`" v-model="form.notifySuccess" type="checkbox" :disabled="pending || services.preferences.readonly"></div>
    <p v-if="error" role="alert" class="shell-error">{{ t(error) }}</p>
    <div class="shell-actions"><UButton type="submit" :loading="pending" :disabled="services.preferences.readonly" icon="i-lucide-check">{{ t('settings.save') }}</UButton></div>
  </form></UCard>
  <div class="shell-theme-note"><strong>{{ t('settings.theme') }}</strong><p>{{ t('settings.themeHelp') }}</p><div class="shell-swatches" aria-hidden="true"><span /><span /><span /><span /></div></div>
</template>
