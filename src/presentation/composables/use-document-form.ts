import { ref, nextTick, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import { useShowcase } from '../stores/showcase';
import { useServices } from '../context/use-services';

export function useDocumentForm() {
  const { t } = useI18n();
  const model = useShowcase();
  const services = useServices();
  const input = model.draft;
  const uid = useId();
  const form = ref<HTMLFormElement>();
  async function preview() {
    model.preview({ ...input });
    await nextTick();
    if (model.error?.field) form.value?.querySelector<HTMLInputElement>(`[name="${model.error.field}"]`)?.focus();
  }
  return { t, services, input, uid, form, preview };
}
