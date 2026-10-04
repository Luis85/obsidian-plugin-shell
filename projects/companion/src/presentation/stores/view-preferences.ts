import { shallowRef, onScopeDispose } from 'vue';
import { defineStore } from 'pinia';
import { useServices } from '../context/use-services';

/** One preference projection and feedback owner for each view's private Pinia. */
export const useViewPreferenceStore = defineStore('view-preferences', () => {
  const services = useServices();
  const owner = `view-${services.newId()}`;
  const preferences = shallowRef(services.preferences.current);
  const stop = services.preferences.subscribe(value => { preferences.value = value; });
  onScopeDispose(() => {
    stop();
    for (const item of services.notifications.current) {
      if (item.owner.startsWith(`${owner}:`)) services.notifications.dismiss(item.id);
    }
  });
  return { owner, preferences };
});
