import { ref, onErrorCaptured, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { en, de } from '@nuxt/ui/locale';
import { pages } from '../stores/showcase';
import { useServices } from '../context/use-services';

export function useShowcaseShell() {
  const { t, locale } = useI18n();
  const services = useServices();
  const failed = ref(false);
  const uiLocale = computed(() => locale.value === 'de' ? de : en);
  onErrorCaptured(() => { failed.value = true; services.diagnostics.report('vue.render', 'view.render'); return false; });
  const icons = { overview: 'i-lucide-layout-dashboard', documents: 'i-lucide-file-plus-2', events: 'i-lucide-radio', settings: 'i-lucide-sliders-horizontal' };
  return { t, locale, services, failed, uiLocale, icons, pages };
}
