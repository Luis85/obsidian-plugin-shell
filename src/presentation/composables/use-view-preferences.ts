import { computed } from 'vue';
import { useViewPreferenceStore } from '../stores/view-preferences';

/** Preferences and feedback belong to this mounted consumer, independently of examples. */
export function useViewPreferences() {
  const store = useViewPreferenceStore();
  return { owner: store.owner, preferences: computed(() => store.preferences) };
}
