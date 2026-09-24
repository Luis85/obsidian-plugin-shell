<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue';
import UInput from '@nuxt/ui/components/Input.vue';
import UCard from '@nuxt/ui/components/Card.vue';
import { useSettingsForm } from '../../composables/use-settings-form';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
const { uid, services, preferences, form, pending, headerPending, error, save, toggleHeader } = useSettingsForm();
</script>
<template>
  <div class="shell-page-heading"><div class="shell-eyebrow">{{ t('nav.settings') }} · Vue I18n</div><h1>{{ t('settings.title') }}</h1><p>{{ t('settings.subtitle') }}</p></div>
  <p v-if="services.preferences.readonly" role="alert" class="shell-error">{{ t(services.preferences.recoveryKey ?? 'settings.blocked') }}</p>
  <UCard class="shell-settings-card"><form class="shell-form" @submit.prevent="save">
    <div class="shell-setting-row"><div><label :for="`${uid}-shell-header`">{{ t('settings.hideHeader') }}</label><p :id="`${uid}-shell-header-help`">{{ t('settings.hideHeaderHelp') }}</p></div><input :id="`${uid}-shell-header`" type="checkbox" :checked="preferences.hideObsidianViewHeader" :aria-describedby="`${uid}-shell-header-help`" :disabled="headerPending || services.preferences.readonly" @change="toggleHeader"></div>
    <p v-if="headerPending" role="status">{{ t('settings.headerSaving') }}</p>
    <div class="shell-setting-row"><div><label :for="`${uid}-shell-locale`">{{ t('settings.language') }}</label><p>{{ t('settings.languageHelp') }}</p></div><select :id="`${uid}-shell-locale`" v-model="form.locale" :disabled="pending || services.preferences.readonly"><option value="en">English</option><option value="de">Deutsch</option></select></div>
    <div class="shell-setting-row"><div><label :for="`${uid}-shell-folder`">{{ t('settings.folder') }}</label><p>{{ t('settings.folderHelp') }}</p></div><UInput :id="`${uid}-shell-folder`" v-model="form.taskFolder" :disabled="pending || services.preferences.readonly" /></div>
    <div class="shell-setting-row"><div><label :for="`${uid}-shell-notices`">{{ t('settings.notices') }}</label><p>{{ t('settings.noticesHelp') }}</p></div><input :id="`${uid}-shell-notices`" v-model="form.notifySuccess" type="checkbox" :disabled="pending || services.preferences.readonly"></div>
    <p v-if="error" role="alert" class="shell-error">{{ t(error) }}</p>
    <div class="shell-actions"><UButton type="submit" :loading="pending" :disabled="services.preferences.readonly" icon="i-lucide-check">{{ t('settings.save') }}</UButton></div>
  </form></UCard>
  <div class="shell-theme-note"><strong>{{ t('settings.theme') }}</strong><p>{{ t('settings.themeHelp') }}</p><div class="shell-swatches" aria-hidden="true"><span /><span /><span /><span /></div></div>
</template>
