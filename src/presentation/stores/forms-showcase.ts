import { ref, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import type { DataFormValues } from '../../domain/forms/model';

/** Per-view result of the example form. The value is shown, never persisted. */
export const useFormsShowcase = defineStore('forms-showcase', () => {
  const submitted = shallowRef<DataFormValues>();
  const preview = ref('');
  function accept(value: DataFormValues) { submitted.value = value; preview.value = JSON.stringify(value, null, 2); }
  return { submitted, preview, accept };
});
