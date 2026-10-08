import { useI18n } from 'vue-i18n';
import { featureBriefForm } from '../../features/showcase/feature-brief';

export function useFormsPage() {
  const { t } = useI18n();
  return { t, definition: featureBriefForm };
}
