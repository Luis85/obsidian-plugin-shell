// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import Subject7 from "../../../src/generated/presentation/components/details/vp-637.vue";
import Subject8 from "../../../src/generated/presentation/components/details/vp-653.vue";
import Subject9 from "../../../src/generated/presentation/components/details/vp-670.vue";
import Subject10 from "../../../src/generated/presentation/components/details/vp-686.vue";
import Subject11 from "../../../src/generated/presentation/components/details/vp-702.vue";
import { visualKey, type VisualContext } from "../../../src/generated/presentation/composables/use-visual.ts";
import type { VisualRequest } from "../../../src/generated/domain/visual-runtime.ts";
import type { ComponentPublicInstance } from 'vue';
function fixture() {
  const handle = vi.fn(async (_request: VisualRequest) => undefined); const navigate = vi.fn((_target: string) => {});
  const runs = Array.from({ length: 7 }, () => vi.fn(async (_input?: unknown) => ({ ok: true })));
  const context: VisualContext = { ports: [{ sourceId: "ds-source-1", operationId: "ds-operation-2", direction: "read", requiresInput: false, data: [{"id":"fixture","type":"requirement","title":"fixture"}], pending: false, error: null, run: runs[0]! },
    { sourceId: "ds-source-1", operationId: "ds-operation-4", direction: "read", requiresInput: false, data: [{"id":"fixture","type":"screen","title":"fixture"}], pending: false, error: null, run: runs[1]! },
    { sourceId: "ds-source-1", operationId: "ds-operation-6", direction: "read", requiresInput: false, data: [{"id":"fixture","type":"component","title":"fixture"}], pending: false, error: null, run: runs[2]! },
    { sourceId: "ds-source-8", operationId: "ds-operation-9", direction: "read", requiresInput: false, data: [{"record":{"id":"fixture","type":"test-recipe","title":"fixture"},"revision":1}], pending: false, error: null, run: runs[3]! },
    { sourceId: "ds-source-8", operationId: "ds-operation-10", direction: "write", requiresInput: true, data: {"record":{"id":"fixture","type":"test-recipe","title":"fixture"},"revision":1}, pending: false, error: null, run: runs[4]! },
    { sourceId: "ds-source-8", operationId: "ds-operation-11", direction: "write", requiresInput: true, data: {"record":{"id":"fixture","type":"test-recipe","title":"fixture"},"revision":1}, pending: false, error: null, run: runs[5]! },
    { sourceId: "ds-source-8", operationId: "ds-operation-12", direction: "write", requiresInput: true, data: undefined, pending: false, error: null, run: runs[6]! }], navigate, handle };
  return { context, handle, navigate, runs, reset() { handle.mockClear(); navigate.mockClear(); for (const run of runs) run.mockClear(); } };
}
function marked(root: Element, id: string): HTMLInputElement { const found = root.querySelector<HTMLInputElement>('[data-design-node="' + id + '"]'); if (!found) throw new Error('Missing node ' + id); return found; }
function expectVisible(root: Element, expected: Record<string, boolean>): void { for (const [id, visible] of Object.entries(expected)) expect(root.querySelector('[data-design-node="' + id + '"]') !== null, id).toBe(visible); }
function disabledWithin(element: Element): boolean { return [element, ...element.querySelectorAll('*')].some(e => e.hasAttribute('disabled') || e.hasAttribute('data-disabled') || e.getAttribute('aria-disabled') === 'true'); }
/** Sets a control the way its component does: by emitting update:modelValue from the rendered instance. */
async function fill(found: { vm: ComponentPublicInstance }[], id: string, raw: unknown): Promise<void> {
  const control = found.find(c => c.vm.$attrs['data-design-node'] === id); if (!control) throw new Error('Missing control ' + id);
  control.vm.$.emit('update:modelValue', raw); await flushPromises();
}
describe("vp-637 Sitemap & views", () => {
const Subject = Subject7;
it("[vi-650] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await fill(wrapper.findAllComponents({ name: "Input" }), "vn-641", "fixture");
    f.reset();
    await wrapper.get("[data-design-node=\"vn-646\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-650"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate.mock.calls.map(([target]) => target)).toEqual(["node-15"]);
  } finally { wrapper.unmount(); }
});
});
describe("vp-637 Sitemap & views", () => {
const Subject = Subject7;
it("[vi-651] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-647\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-651"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expectVisible(wrapper.element, {"vn-638":true,"vn-639":true,"vn-640":true,"vn-641":true,"vn-642":true,"vn-643":true,"vn-645":true,"vn-646":true,"vn-647":true,"vn-648":false,"vn-649":true});
    expect(marked(wrapper.element, "vn-641").contains(document.activeElement)).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-637 Sitemap & views", () => {
const Subject = Subject7;
it("[vi-652] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-649\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-652"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("default");
    expectVisible(wrapper.element, {"vn-638":true,"vn-639":true,"vn-640":true,"vn-641":true,"vn-642":true,"vn-643":true,"vn-645":true,"vn-646":true,"vn-647":true,"vn-648":false,"vn-649":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-653 Pages overview", () => {
const Subject = Subject8;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-654":true,"vn-655":true,"vn-656":true,"vn-657":true,"vn-658":true,"vn-659":true,"vn-661":true,"vn-662":true,"vn-663":true,"vn-664":false,"vn-665":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-653 Pages overview", () => {
const Subject = Subject8;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-654":true,"vn-655":true,"vn-656":true,"vn-657":true,"vn-658":true,"vn-659":true,"vn-661":true,"vn-662":true,"vn-663":true,"vn-664":false,"vn-665":true});
    for (const id of ["vn-657","vn-662","vn-663","vn-665"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-653 Pages overview", () => {
const Subject = Subject8;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-654":true,"vn-655":true,"vn-656":true,"vn-657":true,"vn-658":true,"vn-659":true,"vn-661":true,"vn-662":true,"vn-663":true,"vn-664":false,"vn-665":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-653 Pages overview", () => {
const Subject = Subject8;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-654":true,"vn-655":true,"vn-656":true,"vn-657":true,"vn-658":true,"vn-659":true,"vn-661":true,"vn-662":true,"vn-663":true,"vn-664":true,"vn-665":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-653 Pages overview", () => {
const Subject = Subject8;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-654":true,"vn-655":true,"vn-656":true,"vn-657":true,"vn-658":true,"vn-659":true,"vn-661":true,"vn-662":true,"vn-663":true,"vn-664":false,"vn-665":true});
    for (const id of ["vn-657","vn-662","vn-663","vn-665"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-653 Pages overview", () => {
const Subject = Subject8;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-679" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-654":true,"vn-655":true,"vn-656":true,"vn-657":true,"vn-658":true,"vn-659":true,"vn-661":true,"vn-662":true,"vn-663":true,"vn-664":false,"vn-665":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-653 Pages overview", () => {
const Subject = Subject8;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-680" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-654":true,"vn-655":true,"vn-656":true,"vn-657":true,"vn-658":true,"vn-659":true,"vn-661":true,"vn-662":true,"vn-663":true,"vn-664":false,"vn-665":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-653 Pages overview", () => {
const Subject = Subject8;
it("scenario Recoverable error renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-681" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-654":true,"vn-655":true,"vn-656":true,"vn-657":true,"vn-658":true,"vn-659":true,"vn-661":true,"vn-662":true,"vn-663":true,"vn-664":true,"vn-665":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-653 Pages overview", () => {
const Subject = Subject8;
it("[vi-667] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await fill(wrapper.findAllComponents({ name: "Input" }), "vn-657", "fixture");
    f.reset();
    await wrapper.get("[data-design-node=\"vn-662\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-667"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate.mock.calls.map(([target]) => target)).toEqual(["node-17"]);
  } finally { wrapper.unmount(); }
});
});
describe("vp-653 Pages overview", () => {
const Subject = Subject8;
it("[vi-668] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-663\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-668"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expectVisible(wrapper.element, {"vn-654":true,"vn-655":true,"vn-656":true,"vn-657":true,"vn-658":true,"vn-659":true,"vn-661":true,"vn-662":true,"vn-663":true,"vn-664":false,"vn-665":true});
    expect(marked(wrapper.element, "vn-657").contains(document.activeElement)).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-653 Pages overview", () => {
const Subject = Subject8;
it("[vi-669] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-665\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-669"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("default");
    expectVisible(wrapper.element, {"vn-654":true,"vn-655":true,"vn-656":true,"vn-657":true,"vn-658":true,"vn-659":true,"vn-661":true,"vn-662":true,"vn-663":true,"vn-664":false,"vn-665":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-670 Page editor", () => {
const Subject = Subject9;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-671":true,"vn-672":true,"vn-673":true,"vn-674":true,"vn-675":true,"vn-676":true,"vn-678":true,"vn-679":true,"vn-680":true,"vn-681":false,"vn-682":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-670 Page editor", () => {
const Subject = Subject9;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-671":true,"vn-672":true,"vn-673":true,"vn-674":true,"vn-675":true,"vn-676":true,"vn-678":true,"vn-679":true,"vn-680":true,"vn-681":false,"vn-682":true});
    for (const id of ["vn-674","vn-679","vn-680","vn-682"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-670 Page editor", () => {
const Subject = Subject9;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-671":true,"vn-672":true,"vn-673":true,"vn-674":true,"vn-675":true,"vn-676":true,"vn-678":true,"vn-679":true,"vn-680":true,"vn-681":false,"vn-682":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-670 Page editor", () => {
const Subject = Subject9;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-671":true,"vn-672":true,"vn-673":true,"vn-674":true,"vn-675":true,"vn-676":true,"vn-678":true,"vn-679":true,"vn-680":true,"vn-681":true,"vn-682":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-670 Page editor", () => {
const Subject = Subject9;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-671":true,"vn-672":true,"vn-673":true,"vn-674":true,"vn-675":true,"vn-676":true,"vn-678":true,"vn-679":true,"vn-680":true,"vn-681":false,"vn-682":true});
    for (const id of ["vn-674","vn-679","vn-680","vn-682"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-670 Page editor", () => {
const Subject = Subject9;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-698" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-671":true,"vn-672":true,"vn-673":true,"vn-674":true,"vn-675":true,"vn-676":true,"vn-678":true,"vn-679":true,"vn-680":true,"vn-681":false,"vn-682":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-670 Page editor", () => {
const Subject = Subject9;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-699" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-671":true,"vn-672":true,"vn-673":true,"vn-674":true,"vn-675":true,"vn-676":true,"vn-678":true,"vn-679":true,"vn-680":true,"vn-681":false,"vn-682":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-670 Page editor", () => {
const Subject = Subject9;
it("scenario Recoverable error renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-700" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-671":true,"vn-672":true,"vn-673":true,"vn-674":true,"vn-675":true,"vn-676":true,"vn-678":true,"vn-679":true,"vn-680":true,"vn-681":true,"vn-682":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-670 Page editor", () => {
const Subject = Subject9;
it("[vi-683] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await fill(wrapper.findAllComponents({ name: "Input" }), "vn-674", "fixture");
    f.reset();
    await wrapper.get("[data-design-node=\"vn-679\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-683"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate.mock.calls.map(([target]) => target)).toEqual(["node-29"]);
  } finally { wrapper.unmount(); }
});
});
describe("vp-670 Page editor", () => {
const Subject = Subject9;
it("[vi-684] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-680\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-684"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expectVisible(wrapper.element, {"vn-671":true,"vn-672":true,"vn-673":true,"vn-674":true,"vn-675":true,"vn-676":true,"vn-678":true,"vn-679":true,"vn-680":true,"vn-681":false,"vn-682":true});
    expect(marked(wrapper.element, "vn-674").contains(document.activeElement)).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-670 Page editor", () => {
const Subject = Subject9;
it("[vi-685] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-682\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-685"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("default");
    expectVisible(wrapper.element, {"vn-671":true,"vn-672":true,"vn-673":true,"vn-674":true,"vn-675":true,"vn-676":true,"vn-678":true,"vn-679":true,"vn-680":true,"vn-681":false,"vn-682":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-686 Component editor", () => {
const Subject = Subject10;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-687":true,"vn-688":true,"vn-689":true,"vn-690":true,"vn-691":true,"vn-692":true,"vn-694":true,"vn-695":true,"vn-696":true,"vn-697":false,"vn-698":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-686 Component editor", () => {
const Subject = Subject10;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-687":true,"vn-688":true,"vn-689":true,"vn-690":true,"vn-691":true,"vn-692":true,"vn-694":true,"vn-695":true,"vn-696":true,"vn-697":false,"vn-698":true});
    for (const id of ["vn-690","vn-695","vn-696","vn-698"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-686 Component editor", () => {
const Subject = Subject10;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-687":true,"vn-688":true,"vn-689":true,"vn-690":true,"vn-691":true,"vn-692":true,"vn-694":true,"vn-695":true,"vn-696":true,"vn-697":false,"vn-698":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-686 Component editor", () => {
const Subject = Subject10;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-687":true,"vn-688":true,"vn-689":true,"vn-690":true,"vn-691":true,"vn-692":true,"vn-694":true,"vn-695":true,"vn-696":true,"vn-697":true,"vn-698":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-686 Component editor", () => {
const Subject = Subject10;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-687":true,"vn-688":true,"vn-689":true,"vn-690":true,"vn-691":true,"vn-692":true,"vn-694":true,"vn-695":true,"vn-696":true,"vn-697":false,"vn-698":true});
    for (const id of ["vn-690","vn-695","vn-696","vn-698"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-686 Component editor", () => {
const Subject = Subject10;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-717" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-687":true,"vn-688":true,"vn-689":true,"vn-690":true,"vn-691":true,"vn-692":true,"vn-694":true,"vn-695":true,"vn-696":true,"vn-697":false,"vn-698":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-686 Component editor", () => {
const Subject = Subject10;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-718" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-687":true,"vn-688":true,"vn-689":true,"vn-690":true,"vn-691":true,"vn-692":true,"vn-694":true,"vn-695":true,"vn-696":true,"vn-697":false,"vn-698":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-686 Component editor", () => {
const Subject = Subject10;
it("scenario Recoverable error renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-719" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-687":true,"vn-688":true,"vn-689":true,"vn-690":true,"vn-691":true,"vn-692":true,"vn-694":true,"vn-695":true,"vn-696":true,"vn-697":true,"vn-698":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-686 Component editor", () => {
const Subject = Subject10;
it("[vi-699] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await fill(wrapper.findAllComponents({ name: "Input" }), "vn-690", "fixture");
    f.reset();
    await wrapper.get("[data-design-node=\"vn-695\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-699"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate.mock.calls.map(([target]) => target)).toEqual(["node-29"]);
  } finally { wrapper.unmount(); }
});
});
describe("vp-686 Component editor", () => {
const Subject = Subject10;
it("[vi-700] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-696\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-700"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expectVisible(wrapper.element, {"vn-687":true,"vn-688":true,"vn-689":true,"vn-690":true,"vn-691":true,"vn-692":true,"vn-694":true,"vn-695":true,"vn-696":true,"vn-697":false,"vn-698":true});
    expect(marked(wrapper.element, "vn-690").contains(document.activeElement)).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-686 Component editor", () => {
const Subject = Subject10;
it("[vi-701] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-698\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-701"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("default");
    expectVisible(wrapper.element, {"vn-687":true,"vn-688":true,"vn-689":true,"vn-690":true,"vn-691":true,"vn-692":true,"vn-694":true,"vn-695":true,"vn-696":true,"vn-697":false,"vn-698":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-702 Entity relationships", () => {
const Subject = Subject11;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-703":true,"vn-704":true,"vn-705":true,"vn-706":true,"vn-707":true,"vn-708":true,"vn-710":true,"vn-711":true,"vn-712":true,"vn-713":false,"vn-714":true});
  } finally { wrapper.unmount(); }
});
});
