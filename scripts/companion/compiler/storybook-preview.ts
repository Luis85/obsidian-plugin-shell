import { literal, type Model } from './model.ts';
import { relativeImport } from './file-code.ts';

/** Browser-only harness. Each story owns an app, Pinia, synthetic sources and disposal.
 * Neither native bootstrap nor persistence/network adapters are imported. */
export function storybookPreview(m: Model, file: string): string {
  const source = (path: string) => literal(relativeImport(file, `${m.sourceRoot}/${path}`));
  return `import { createApp, defineComponent, h, onBeforeUnmount, onMounted, ref, type App, type Component } from 'vue';
import { createPinia, disposePinia } from 'pinia';
import { fn } from 'storybook/test';
import UApp from '@nuxt/ui/components/App.vue';
import { createClickdummySources } from ${source('bootstrap/clickdummy-sources.ts')};
import { bindFlows } from ${source('bootstrap/flows.ts')};
import { createVisualContext } from ${source('bootstrap/visual-context.ts')};
import { provideVisualContext } from ${source('presentation/composables/use-visual.ts')};
import { projectKey } from ${source('presentation/context/project.ts')};
import { useNavigation } from ${source('presentation/stores/navigation.ts')};
import ${literal(relativeImport(file, 'harness/styles/simulated.css'))};
import ${literal(relativeImport(file, 'src/styles/app.css'))};
import ${source('styles/project.css')};
import ${source('presentation/detail-layout.css')};

interface PreviewOptions { initial?: string; slots?: string[]; events?: string[]; scenarioWidths?: Record<string, string> }
/** Args stay reactive across Controls updates; state and mocks never leak between Docs stories. */
export function projectPreview(subject: Component, args: object, options: PreviewOptions = {}): Component {
  return defineComponent({
    name: 'GeneratedStoryPreview',
    setup() {
      const target = ref<HTMLElement>(); const message = ref('');
      const pinia = createPinia(); let app: App | undefined;
      const listeners = Object.fromEntries((options.events ?? []).map(event => {
        const name = event.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
        return ['on' + name.charAt(0).toUpperCase() + name.slice(1), fn().mockName(event)];
      }));
      const slots = Object.fromEntries((options.slots ?? []).map(name => [name, () => 'Preview slot: ' + name]));
      onMounted(() => {
        if (!target.value) return;
        const sources = createClickdummySources(); const navigation = useNavigation(pinia);
        if (options.initial) navigation.open(options.initial);
        const openModal = (id: string) => { message.value = 'Modal target: ' + id + '. Open its own story to inspect it.'; };
        const instance = createApp({ name: 'IsolatedStoryRoot', setup: () => () => {
          const scenario = 'designScenario' in args && typeof args.designScenario === 'string' ? args.designScenario : '';
          const narrow = options.scenarioWidths?.[scenario] === 'narrow';
          return h(UApp, null, { default: () => h('div', { style: { maxWidth: narrow ? '390px' : undefined } }, [h(subject, { ...listeners, ...args }, slots)]) });
        } });
        app = instance;
        instance.use(pinia);
        instance.runWithContext(() => {
          instance.provide(projectKey, { panels: {}, flows: bindFlows(sources, pinia), isolated: true, openModal });
          const context = createVisualContext(sources, pinia, openModal);
          provideVisualContext(instance, { ...context, navigate(id) {
            context.navigate(id); message.value = 'Navigation target: ' + id + '. Open its story to inspect it.';
          } });
        });
        // Do not hide runtime failures or report generated examples as accepted behavior.
        instance.config.errorHandler = error => { message.value = 'Preview error: ' + String(error); console.error(error); };
        instance.mount(target.value);
      });
      onBeforeUnmount(() => { try { app?.unmount(); } finally { disposePinia(pinia); } });
      return () => h('section', { class: ${literal('ps--' + String(m.project.id))}, 'data-plugin-ui': ${literal(String(m.project.id))}, 'data-storybook-preview': 'synthetic' }, [
        h('div', { ref: target }),
        message.value ? h('p', { role: 'status' }, message.value) : null,
      ]);
    },
  });
}
`;
}
