// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import Subject24 from "../../../src/generated/presentation/components/details/vp-938.vue";
import Subject25 from "../../../src/generated/presentation/components/details/vp-955.vue";
import Subject26 from "../../../src/generated/presentation/components/details/vp-977.vue";
import Subject27 from "../../../src/generated/presentation/components/library/record-card.vue";
import Subject28 from "../../../src/generated/presentation/components/library/capture-form.vue";
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
describe("vp-938 Workbench preferences", () => {
const Subject = Subject24;
it("[vi-954] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-951\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-954"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("default");
    expectVisible(wrapper.element, {"vn-939":true,"vn-940":true,"vn-941":true,"vn-942":true,"vn-943":true,"vn-944":true,"vn-945":true,"vn-947":true,"vn-948":true,"vn-949":true,"vn-950":false,"vn-951":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-955 Export project JSON", () => {
const Subject = Subject25;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-956":true,"vn-957":true,"vn-958":true,"vn-959":true,"vn-960":true,"vn-968":true,"vn-969":true,"vn-970":true,"vn-971":true,"vn-972":true,"vn-973":true,"vn-961":true,"vn-963":true,"vn-964":true,"vn-965":true,"vn-966":false,"vn-967":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-955 Export project JSON", () => {
const Subject = Subject25;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-956":true,"vn-957":true,"vn-958":true,"vn-959":true,"vn-960":true,"vn-968":true,"vn-969":true,"vn-970":true,"vn-971":true,"vn-972":true,"vn-973":true,"vn-961":true,"vn-963":true,"vn-964":true,"vn-965":true,"vn-966":false,"vn-967":true});
    for (const id of ["vn-959","vn-964","vn-965","vn-967"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-955 Export project JSON", () => {
const Subject = Subject25;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-956":true,"vn-957":true,"vn-958":true,"vn-959":true,"vn-960":true,"vn-968":true,"vn-969":true,"vn-970":true,"vn-971":true,"vn-972":true,"vn-973":true,"vn-961":true,"vn-963":true,"vn-964":true,"vn-965":true,"vn-966":false,"vn-967":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-955 Export project JSON", () => {
const Subject = Subject25;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-956":true,"vn-957":true,"vn-958":true,"vn-959":true,"vn-960":true,"vn-968":true,"vn-969":true,"vn-970":true,"vn-971":true,"vn-972":true,"vn-973":true,"vn-961":true,"vn-963":true,"vn-964":true,"vn-965":true,"vn-966":true,"vn-967":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-955 Export project JSON", () => {
const Subject = Subject25;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-956":true,"vn-957":true,"vn-958":true,"vn-959":true,"vn-960":true,"vn-968":true,"vn-969":true,"vn-970":true,"vn-971":true,"vn-972":true,"vn-973":true,"vn-961":true,"vn-963":true,"vn-964":true,"vn-965":true,"vn-966":false,"vn-967":true});
    for (const id of ["vn-959","vn-964","vn-965","vn-967"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-955 Export project JSON", () => {
const Subject = Subject25;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-1003" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-956":true,"vn-957":true,"vn-958":true,"vn-959":true,"vn-960":true,"vn-968":true,"vn-969":true,"vn-970":true,"vn-971":true,"vn-972":true,"vn-973":true,"vn-961":true,"vn-963":true,"vn-964":true,"vn-965":true,"vn-966":false,"vn-967":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-955 Export project JSON", () => {
const Subject = Subject25;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-1004" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-956":true,"vn-957":true,"vn-958":true,"vn-959":true,"vn-960":true,"vn-968":true,"vn-969":true,"vn-970":true,"vn-971":true,"vn-972":true,"vn-973":true,"vn-961":true,"vn-963":true,"vn-964":true,"vn-965":true,"vn-966":false,"vn-967":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-955 Export project JSON", () => {
const Subject = Subject25;
it("scenario Recoverable error renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-1005" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-956":true,"vn-957":true,"vn-958":true,"vn-959":true,"vn-960":true,"vn-968":true,"vn-969":true,"vn-970":true,"vn-971":true,"vn-972":true,"vn-973":true,"vn-961":true,"vn-963":true,"vn-964":true,"vn-965":true,"vn-966":true,"vn-967":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-955 Export project JSON", () => {
const Subject = Subject25;
it("[vi-974] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await fill(wrapper.findAllComponents({ name: "Input" }), "vn-959", "fixture");
    f.reset();
    await wrapper.get("[data-design-node=\"vn-964\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-974"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate.mock.calls.map(([target]) => target)).toEqual(["node-54"]);
  } finally { wrapper.unmount(); }
});
});
describe("vp-955 Export project JSON", () => {
const Subject = Subject25;
it("[vi-975] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-965\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-975"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expectVisible(wrapper.element, {"vn-956":true,"vn-957":true,"vn-958":true,"vn-959":true,"vn-960":true,"vn-968":true,"vn-969":true,"vn-970":true,"vn-971":true,"vn-972":true,"vn-973":true,"vn-961":true,"vn-963":true,"vn-964":true,"vn-965":true,"vn-966":false,"vn-967":true});
    expect(marked(wrapper.element, "vn-959").contains(document.activeElement)).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-955 Export project JSON", () => {
const Subject = Subject25;
it("[vi-976] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-967\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-976"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("default");
    expectVisible(wrapper.element, {"vn-956":true,"vn-957":true,"vn-958":true,"vn-959":true,"vn-960":true,"vn-968":true,"vn-969":true,"vn-970":true,"vn-971":true,"vn-972":true,"vn-973":true,"vn-961":true,"vn-963":true,"vn-964":true,"vn-965":true,"vn-966":false,"vn-967":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-977 Shell JSON handoff", () => {
const Subject = Subject26;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-978":true,"vn-979":true,"vn-980":true,"vn-981":true,"vn-982":true,"vn-983":true,"vn-985":true,"vn-986":true,"vn-987":true,"vn-988":false,"vn-989":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-977 Shell JSON handoff", () => {
const Subject = Subject26;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-978":true,"vn-979":true,"vn-980":true,"vn-981":true,"vn-982":true,"vn-983":true,"vn-985":true,"vn-986":true,"vn-987":true,"vn-988":false,"vn-989":true});
    for (const id of ["vn-981","vn-982","vn-986","vn-987","vn-989"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-977 Shell JSON handoff", () => {
const Subject = Subject26;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-978":true,"vn-979":true,"vn-980":true,"vn-981":true,"vn-982":true,"vn-983":true,"vn-985":true,"vn-986":true,"vn-987":true,"vn-988":false,"vn-989":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-977 Shell JSON handoff", () => {
const Subject = Subject26;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-978":true,"vn-979":true,"vn-980":true,"vn-981":true,"vn-982":true,"vn-983":true,"vn-985":true,"vn-986":true,"vn-987":true,"vn-988":true,"vn-989":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-977 Shell JSON handoff", () => {
const Subject = Subject26;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-978":true,"vn-979":true,"vn-980":true,"vn-981":true,"vn-982":true,"vn-983":true,"vn-985":true,"vn-986":true,"vn-987":true,"vn-988":false,"vn-989":true});
    for (const id of ["vn-981","vn-982","vn-986","vn-987","vn-989"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-977 Shell JSON handoff", () => {
const Subject = Subject26;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-1022" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-978":true,"vn-979":true,"vn-980":true,"vn-981":true,"vn-982":true,"vn-983":true,"vn-985":true,"vn-986":true,"vn-987":true,"vn-988":false,"vn-989":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-977 Shell JSON handoff", () => {
const Subject = Subject26;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-1023" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-978":true,"vn-979":true,"vn-980":true,"vn-981":true,"vn-982":true,"vn-983":true,"vn-985":true,"vn-986":true,"vn-987":true,"vn-988":false,"vn-989":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-977 Shell JSON handoff", () => {
const Subject = Subject26;
it("scenario Recoverable error renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-1024" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-978":true,"vn-979":true,"vn-980":true,"vn-981":true,"vn-982":true,"vn-983":true,"vn-985":true,"vn-986":true,"vn-987":true,"vn-988":true,"vn-989":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-977 Shell JSON handoff", () => {
const Subject = Subject26;
it("[vi-990] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await fill(wrapper.findAllComponents({ name: "Input" }), "vn-981", "fixture");
    await fill(wrapper.findAllComponents({ name: "Textarea" }), "vn-982", "fixture");
    f.reset();
    await wrapper.get("[data-design-node=\"vn-986\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-990"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate.mock.calls.map(([target]) => target)).toEqual(["node-35"]);
  } finally { wrapper.unmount(); }
});
});
describe("vp-977 Shell JSON handoff", () => {
const Subject = Subject26;
it("[vi-991] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-987\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-991"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expectVisible(wrapper.element, {"vn-978":true,"vn-979":true,"vn-980":true,"vn-981":true,"vn-982":true,"vn-983":true,"vn-985":true,"vn-986":true,"vn-987":true,"vn-988":false,"vn-989":true});
    expect(marked(wrapper.element, "vn-981").contains(document.activeElement)).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-977 Shell JSON handoff", () => {
const Subject = Subject26;
it("[vi-992] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-989\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-992"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("default");
    expectVisible(wrapper.element, {"vn-978":true,"vn-979":true,"vn-980":true,"vn-981":true,"vn-982":true,"vn-983":true,"vn-985":true,"vn-986":true,"vn-987":true,"vn-988":false,"vn-989":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-55 RecordCard", () => {
const Subject = Subject27;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","selected":false}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-128":true,"vn-129":true,"vn-130":true,"vn-131":true,"vn-133":true,"vn-132":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-55 RecordCard", () => {
const Subject = Subject27;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","selected":false}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-128":true,"vn-129":true,"vn-130":true,"vn-131":true,"vn-133":true,"vn-132":true});
    for (const id of ["vn-132"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-55 RecordCard", () => {
const Subject = Subject27;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","selected":false}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-128":true,"vn-129":true,"vn-130":true,"vn-131":true,"vn-133":true,"vn-132":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-55 RecordCard", () => {
const Subject = Subject27;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","selected":false}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-128":true,"vn-129":true,"vn-130":true,"vn-131":true,"vn-133":true,"vn-132":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-55 RecordCard", () => {
const Subject = Subject27;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","selected":false}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-128":true,"vn-129":true,"vn-130":true,"vn-131":true,"vn-133":true,"vn-132":true});
    for (const id of ["vn-132"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-55 RecordCard", () => {
const Subject = Subject27;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","selected":false}, designScenario: "scenario-26" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-128":true,"vn-129":true,"vn-130":true,"vn-131":true,"vn-133":true,"vn-132":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-55 RecordCard", () => {
const Subject = Subject27;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","selected":false}, designScenario: "scenario-27" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-128":true,"vn-129":true,"vn-130":true,"vn-131":true,"vn-133":true,"vn-132":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-55 RecordCard", () => {
const Subject = Subject27;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","selected":false}, designScenario: "scenario-28" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-128":true,"vn-129":true,"vn-130":true,"vn-131":true,"vn-133":true,"vn-132":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-55 RecordCard", () => {
const Subject = Subject27;
it("[vi-134] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture","selected":false}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-132\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-134"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-128":true,"vn-129":true,"vn-130":true,"vn-131":true,"vn-133":true,"vn-132":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-56 CaptureForm", () => {
const Subject = Subject28;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-135":true,"vn-136":true,"vn-137":true,"vn-138":true,"vn-140":true,"vn-139":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-56 CaptureForm", () => {
const Subject = Subject28;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-135":true,"vn-136":true,"vn-137":true,"vn-138":true,"vn-140":true,"vn-139":true});
    for (const id of ["vn-137","vn-139"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-56 CaptureForm", () => {
const Subject = Subject28;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-135":true,"vn-136":true,"vn-137":true,"vn-138":true,"vn-140":true,"vn-139":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-56 CaptureForm", () => {
const Subject = Subject28;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-135":true,"vn-136":true,"vn-137":true,"vn-138":true,"vn-140":true,"vn-139":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-56 CaptureForm", () => {
const Subject = Subject28;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-135":true,"vn-136":true,"vn-137":true,"vn-138":true,"vn-140":true,"vn-139":true});
    for (const id of ["vn-137","vn-139"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-56 CaptureForm", () => {
const Subject = Subject28;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designScenario: "scenario-36" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-135":true,"vn-136":true,"vn-137":true,"vn-138":true,"vn-140":true,"vn-139":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-56 CaptureForm", () => {
const Subject = Subject28;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designScenario: "scenario-37" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-135":true,"vn-136":true,"vn-137":true,"vn-138":true,"vn-140":true,"vn-139":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-56 CaptureForm", () => {
const Subject = Subject28;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designScenario: "scenario-38" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-135":true,"vn-136":true,"vn-137":true,"vn-138":true,"vn-140":true,"vn-139":true}); } finally { wrapper.unmount(); }
});
});
