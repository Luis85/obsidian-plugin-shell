import { literal, type Model } from './model.ts';
import { relativeImport } from './file-code.ts';
/** A separate Vue app and Pinia per mounted story: no singleton state, Obsidian imports or live data adapters. */
export function storybookHost(model: Model): string {
  const path = 'storybook/generated/with-project.ts';
  const from = (file: string) => literal(relativeImport(path, model.sourceRoot + '/' + file));
  return `import { createApp, defineComponent, h, onBeforeUnmount, onMounted, ref } from 'vue';
import ui from '@nuxt/ui/vue-plugin';
import { createPinia, disposePinia } from 'pinia';
import type { Decorator } from '@storybook/vue3-vite';
import UApp from '@nuxt/ui/components/App.vue';
import { panels } from ${from('bootstrap/panels.ts')};
import { projectKey } from ${from('presentation/context/project.ts')};
import { createClickdummySources } from ${from('bootstrap/clickdummy-sources.ts')};
import { bindFlows } from ${from('bootstrap/flows.ts')};
import { createVisualContext } from ${from('bootstrap/visual-context.ts')};
import { provideVisualContext } from ${from('presentation/composables/use-visual.ts')};
import { useNavigation } from ${from('presentation/stores/navigation.ts')};
import { screens } from ${from('domain/screens.ts')};
import '../../harness/styles/simulated.css';
import '../../src/styles/app.css';
import ${from('styles/project.css')};
import ${from('presentation/detail-layout.css')};
const owner = ${literal(model.project.id)};
export const withProject: Decorator = (story, context) => {
  const Story = story();
  return defineComponent({ name: 'GeneratedStoryHost', setup() {
    const mount = ref<HTMLElement>(), message = ref('');
    let cleanup: (() => void) | undefined;
    onMounted(() => {
      if (!mount.value) return;
      const pinia = createPinia(), sources = createClickdummySources();
      const app = createApp({ render: () => h(UApp, null, { default: () => h(Story) }) });
      cleanup = () => { app.unmount(); disposePinia(pinia); };
      try {
      app.use(pinia); app.use(ui);
      const describeNavigation = (id: string) => { message.value = 'Preview navigation: ' + (screens.find(s => s.id === id)?.label ?? id) + '. Open that page in the story list.'; };
      const navigation = useNavigation(pinia);
      const surface: unknown = context.parameters.shell?.surface;
      if (typeof surface === 'string' && screens.some(s => s.id === surface)) navigation.open(surface);
      app.runWithContext(() => {
        app.provide(projectKey, { panels, flows: bindFlows(sources, pinia), isolated: true, openModal: describeNavigation });
        const visual = createVisualContext(sources, pinia, describeNavigation);
        provideVisualContext(app, { ...visual, navigate: describeNavigation });
      });
      app.config.errorHandler = error => { console.error(error); message.value = 'Implementation required: this story encountered an unfinished adapter or capability. This is not accepted functionality.'; };
      app.mount(mount.value);
      } catch (error) { cleanup(); cleanup = undefined; throw error; }
    });
    onBeforeUnmount(() => cleanup?.());
    return () => h('section', { 'data-plugin-ui': owner, 'data-story-host': '',
      class: ['obsidian-harness', owner, 'ps--' + owner, context.globals.theme === 'dark' ? 'theme-dark dark' : 'theme-light'],
      style: { maxWidth: context.parameters.shell?.width === 'narrow' ? '360px' : '100%', minHeight: '120px', padding: '16px',
        background: 'var(--' + owner + '-surface, var(--background-primary))', color: 'var(--' + owner + '-text, var(--text-normal))',
        fontFamily: 'var(--font-interface)', fontSize: 'var(--font-ui-medium)', lineHeight: 'var(--line-height-normal)',
      },
    }, [h('div', { ref: mount }), message.value ? h('p', { role: 'status', 'data-story-message': '' }, message.value) : null]);
  } });
};
`;
}
