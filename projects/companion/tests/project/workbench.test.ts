// @vitest-environment happy-dom
import { it, expect } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, disposePinia } from 'pinia';
import Workbench from "../../src/generated/presentation/components/ProjectWorkbench.vue";
import { panels } from "../../src/generated/bootstrap/panels.ts";
import { projectKey } from "../../src/generated/presentation/context/project.ts";
import { createJourneyPreview } from "../../src/generated/bootstrap/journey-preview.ts";
import { provideJourney } from "../../src/generated/bootstrap/journey-workspace.ts";
it('mounts the generated product screens with isolated view state', async () => { const pinia = createPinia(); const journey=createJourneyPreview(); const wrapper = mount(Workbench,{global:{plugins:[pinia, {install: app => provideJourney(app,pinia,journey)}],provide:{[projectKey as symbol]:{panels,flows:[],isolated:false,openModal:()=>{}}}}}); try { await flushPromises(); expect(wrapper.find('h2').exists()).toBe(true); for (const button of wrapper.findAll('nav button').filter(b => b.text() !== 'Back')) { await button.trigger('click'); await flushPromises(); expect(wrapper.find('h2').text()).toBe(button.text()); } } finally { wrapper.unmount(); journey.dispose(); disposePinia(pinia); } });
