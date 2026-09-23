import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { en, de } from '@nuxt/ui/locale';

export function useAuthoringView() {
  const { t, locale } = useI18n();
  return { t, locale, uiLocale: computed(() => locale.value === 'de' ? de : en) };
}
