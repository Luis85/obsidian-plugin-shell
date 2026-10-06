// @vitest-environment happy-dom
import { it, expect } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, disposePinia } from 'pinia';
import type { ComponentPublicInstance } from 'vue';
import { fixtureSources } from '../fixtures/visual-sources.ts';
import Subject from "../../../src/generated/presentation/components/details/vp-587.vue";
import { createVisualContext } from "../../../src/generated/bootstrap/visual-context.ts";
import { visualKey } from "../../../src/generated/presentation/composables/use-visual.ts";
/** The value one rendered component instance (found by its node marker) received for a bound prop, declared or fallthrough. */
function bound(found: { vm: ComponentPublicInstance }[], id: string, name: string): unknown {
  const instance = found.find(c => c.vm.$attrs['data-design-node'] === id); if (!instance) throw new Error('Missing component instance ' + id);
  const props: Record<string, unknown> = instance.vm.$props;
  return Object.hasOwn(props, name) ? props[name] : instance.vm.$attrs[name];
}
it("[vn-592] displays validated source output through the actual Pinia store", async () => {
  const pinia = createPinia(); const context = createVisualContext(fixtureSources(), pinia, () => {});
  const wrapper = mount(Subject, { props: {}, global: { plugins: [pinia], provide: { [visualKey as symbol]: context } } });
  try {
    const portlistrequirements = context.ports.find(p => p.sourceId === "ds-source-1" && p.operationId === "ds-operation-2")!;
    await portlistrequirements.run(undefined); await flushPromises();
    expect(portlistrequirements.pending).toBe(false); expect(portlistrequirements.error).toBe(null);
    expect(bound(wrapper.findAllComponents({ name: "Table" }), "vn-592", "data")).toEqual([{"id":"fixture","type":"requirement","title":"fixture"}]);
    expect(wrapper.get("[data-design-node=\"vn-592\"]").findAll('tbody tr')).toHaveLength(1);
    expect(wrapper.get("[data-design-node=\"vn-592\"]").findAll('tbody tr')[0]!.findAll('td')[0]!.text()).toBe("fixture");
    expect(wrapper.get("[data-design-node=\"vn-592\"]").findAll('tbody tr')[0]!.findAll('td')[1]!.text()).toBe("");
    expect(wrapper.get("[data-design-node=\"vn-592\"]").findAll('tbody tr')[0]!.findAll('td')[2]!.text()).toBe("");
  } finally { wrapper.unmount(); disposePinia(pinia); }
});
