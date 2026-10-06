// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import Subject11 from "../../../src/generated/presentation/components/details/vp-702.vue";
import Subject12 from "../../../src/generated/presentation/components/details/vp-719.vue";
import Subject13 from "../../../src/generated/presentation/components/details/vp-736.vue";
import Subject14 from "../../../src/generated/presentation/components/details/vp-753.vue";
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
describe("vp-702 Entity relationships", () => {
const Subject = Subject11;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-703":true,"vn-704":true,"vn-705":true,"vn-706":true,"vn-707":true,"vn-708":true,"vn-710":true,"vn-711":true,"vn-712":true,"vn-713":false,"vn-714":true});
    for (const id of ["vn-706","vn-711","vn-712","vn-714"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-702 Entity relationships", () => {
const Subject = Subject11;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-703":true,"vn-704":true,"vn-705":true,"vn-706":true,"vn-707":true,"vn-708":true,"vn-710":true,"vn-711":true,"vn-712":true,"vn-713":false,"vn-714":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-702 Entity relationships", () => {
const Subject = Subject11;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-703":true,"vn-704":true,"vn-705":true,"vn-706":true,"vn-707":true,"vn-708":true,"vn-710":true,"vn-711":true,"vn-712":true,"vn-713":true,"vn-714":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-702 Entity relationships", () => {
const Subject = Subject11;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-703":true,"vn-704":true,"vn-705":true,"vn-706":true,"vn-707":true,"vn-708":true,"vn-710":true,"vn-711":true,"vn-712":true,"vn-713":false,"vn-714":true});
    for (const id of ["vn-706","vn-711","vn-712","vn-714"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-702 Entity relationships", () => {
const Subject = Subject11;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-736" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-703":true,"vn-704":true,"vn-705":true,"vn-706":true,"vn-707":true,"vn-708":true,"vn-710":true,"vn-711":true,"vn-712":true,"vn-713":false,"vn-714":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-702 Entity relationships", () => {
const Subject = Subject11;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-737" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-703":true,"vn-704":true,"vn-705":true,"vn-706":true,"vn-707":true,"vn-708":true,"vn-710":true,"vn-711":true,"vn-712":true,"vn-713":false,"vn-714":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-702 Entity relationships", () => {
const Subject = Subject11;
it("scenario Recoverable error renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-738" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-703":true,"vn-704":true,"vn-705":true,"vn-706":true,"vn-707":true,"vn-708":true,"vn-710":true,"vn-711":true,"vn-712":true,"vn-713":true,"vn-714":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-702 Entity relationships", () => {
const Subject = Subject11;
it("[vi-716] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await fill(wrapper.findAllComponents({ name: "Input" }), "vn-706", "fixture");
    f.reset();
    await wrapper.get("[data-design-node=\"vn-711\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-716"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate.mock.calls.map(([target]) => target)).toEqual(["node-23"]);
  } finally { wrapper.unmount(); }
});
});
describe("vp-702 Entity relationships", () => {
const Subject = Subject11;
it("[vi-717] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-712\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-717"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expectVisible(wrapper.element, {"vn-703":true,"vn-704":true,"vn-705":true,"vn-706":true,"vn-707":true,"vn-708":true,"vn-710":true,"vn-711":true,"vn-712":true,"vn-713":false,"vn-714":true});
    expect(marked(wrapper.element, "vn-706").contains(document.activeElement)).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-702 Entity relationships", () => {
const Subject = Subject11;
it("[vi-718] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-714\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-718"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("default");
    expectVisible(wrapper.element, {"vn-703":true,"vn-704":true,"vn-705":true,"vn-706":true,"vn-707":true,"vn-708":true,"vn-710":true,"vn-711":true,"vn-712":true,"vn-713":false,"vn-714":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-719 Data Sources", () => {
const Subject = Subject12;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-720":true,"vn-721":true,"vn-722":true,"vn-723":true,"vn-724":true,"vn-725":true,"vn-727":true,"vn-728":true,"vn-729":true,"vn-730":false,"vn-731":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-719 Data Sources", () => {
const Subject = Subject12;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-720":true,"vn-721":true,"vn-722":true,"vn-723":true,"vn-724":true,"vn-725":true,"vn-727":true,"vn-728":true,"vn-729":true,"vn-730":false,"vn-731":true});
    for (const id of ["vn-723","vn-728","vn-729","vn-731"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-719 Data Sources", () => {
const Subject = Subject12;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-720":true,"vn-721":true,"vn-722":true,"vn-723":true,"vn-724":true,"vn-725":true,"vn-727":true,"vn-728":true,"vn-729":true,"vn-730":false,"vn-731":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-719 Data Sources", () => {
const Subject = Subject12;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-720":true,"vn-721":true,"vn-722":true,"vn-723":true,"vn-724":true,"vn-725":true,"vn-727":true,"vn-728":true,"vn-729":true,"vn-730":true,"vn-731":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-719 Data Sources", () => {
const Subject = Subject12;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-720":true,"vn-721":true,"vn-722":true,"vn-723":true,"vn-724":true,"vn-725":true,"vn-727":true,"vn-728":true,"vn-729":true,"vn-730":false,"vn-731":true});
    for (const id of ["vn-723","vn-728","vn-729","vn-731"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-719 Data Sources", () => {
const Subject = Subject12;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-755" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-720":true,"vn-721":true,"vn-722":true,"vn-723":true,"vn-724":true,"vn-725":true,"vn-727":true,"vn-728":true,"vn-729":true,"vn-730":false,"vn-731":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-719 Data Sources", () => {
const Subject = Subject12;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-756" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-720":true,"vn-721":true,"vn-722":true,"vn-723":true,"vn-724":true,"vn-725":true,"vn-727":true,"vn-728":true,"vn-729":true,"vn-730":false,"vn-731":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-719 Data Sources", () => {
const Subject = Subject12;
it("scenario Recoverable error renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-757" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-720":true,"vn-721":true,"vn-722":true,"vn-723":true,"vn-724":true,"vn-725":true,"vn-727":true,"vn-728":true,"vn-729":true,"vn-730":true,"vn-731":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-719 Data Sources", () => {
const Subject = Subject12;
it("[vi-733] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await fill(wrapper.findAllComponents({ name: "Input" }), "vn-723", "fixture");
    f.reset();
    await wrapper.get("[data-design-node=\"vn-728\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-733"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate.mock.calls.map(([target]) => target)).toEqual(["node-25"]);
  } finally { wrapper.unmount(); }
});
});
describe("vp-719 Data Sources", () => {
const Subject = Subject12;
it("[vi-734] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-729\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-734"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expectVisible(wrapper.element, {"vn-720":true,"vn-721":true,"vn-722":true,"vn-723":true,"vn-724":true,"vn-725":true,"vn-727":true,"vn-728":true,"vn-729":true,"vn-730":false,"vn-731":true});
    expect(marked(wrapper.element, "vn-723").contains(document.activeElement)).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-719 Data Sources", () => {
const Subject = Subject12;
it("[vi-735] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-731\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-735"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("default");
    expectVisible(wrapper.element, {"vn-720":true,"vn-721":true,"vn-722":true,"vn-723":true,"vn-724":true,"vn-725":true,"vn-727":true,"vn-728":true,"vn-729":true,"vn-730":false,"vn-731":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-736 Test Data", () => {
const Subject = Subject13;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-737":true,"vn-738":true,"vn-739":true,"vn-740":true,"vn-741":true,"vn-742":true,"vn-744":true,"vn-745":true,"vn-746":true,"vn-747":false,"vn-748":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-736 Test Data", () => {
const Subject = Subject13;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-737":true,"vn-738":true,"vn-739":true,"vn-740":true,"vn-741":true,"vn-742":true,"vn-744":true,"vn-745":true,"vn-746":true,"vn-747":false,"vn-748":true});
    for (const id of ["vn-740","vn-745","vn-746","vn-748"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-736 Test Data", () => {
const Subject = Subject13;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-737":true,"vn-738":true,"vn-739":true,"vn-740":true,"vn-741":true,"vn-742":true,"vn-744":true,"vn-745":true,"vn-746":true,"vn-747":false,"vn-748":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-736 Test Data", () => {
const Subject = Subject13;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-737":true,"vn-738":true,"vn-739":true,"vn-740":true,"vn-741":true,"vn-742":true,"vn-744":true,"vn-745":true,"vn-746":true,"vn-747":true,"vn-748":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-736 Test Data", () => {
const Subject = Subject13;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-737":true,"vn-738":true,"vn-739":true,"vn-740":true,"vn-741":true,"vn-742":true,"vn-744":true,"vn-745":true,"vn-746":true,"vn-747":false,"vn-748":true});
    for (const id of ["vn-740","vn-745","vn-746","vn-748"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-736 Test Data", () => {
const Subject = Subject13;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-774" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-737":true,"vn-738":true,"vn-739":true,"vn-740":true,"vn-741":true,"vn-742":true,"vn-744":true,"vn-745":true,"vn-746":true,"vn-747":false,"vn-748":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-736 Test Data", () => {
const Subject = Subject13;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-775" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-737":true,"vn-738":true,"vn-739":true,"vn-740":true,"vn-741":true,"vn-742":true,"vn-744":true,"vn-745":true,"vn-746":true,"vn-747":false,"vn-748":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-736 Test Data", () => {
const Subject = Subject13;
it("scenario Recoverable error renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-776" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-737":true,"vn-738":true,"vn-739":true,"vn-740":true,"vn-741":true,"vn-742":true,"vn-744":true,"vn-745":true,"vn-746":true,"vn-747":true,"vn-748":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-736 Test Data", () => {
const Subject = Subject13;
it("[vi-750] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await fill(wrapper.findAllComponents({ name: "Input" }), "vn-740", "fixture");
    f.reset();
    await wrapper.get("[data-design-node=\"vn-745\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-750"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate.mock.calls.map(([target]) => target)).toEqual(["node-23"]);
  } finally { wrapper.unmount(); }
});
});
describe("vp-736 Test Data", () => {
const Subject = Subject13;
it("[vi-751] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-746\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-751"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expectVisible(wrapper.element, {"vn-737":true,"vn-738":true,"vn-739":true,"vn-740":true,"vn-741":true,"vn-742":true,"vn-744":true,"vn-745":true,"vn-746":true,"vn-747":false,"vn-748":true});
    expect(marked(wrapper.element, "vn-740").contains(document.activeElement)).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-736 Test Data", () => {
const Subject = Subject13;
it("[vi-752] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-748\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-752"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("default");
    expectVisible(wrapper.element, {"vn-737":true,"vn-738":true,"vn-739":true,"vn-740":true,"vn-741":true,"vn-742":true,"vn-744":true,"vn-745":true,"vn-746":true,"vn-747":false,"vn-748":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-753 Design System", () => {
const Subject = Subject14;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-754":true,"vn-755":true,"vn-756":true,"vn-757":true,"vn-758":true,"vn-759":true,"vn-761":true,"vn-762":true,"vn-763":true,"vn-764":false,"vn-765":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-753 Design System", () => {
const Subject = Subject14;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-754":true,"vn-755":true,"vn-756":true,"vn-757":true,"vn-758":true,"vn-759":true,"vn-761":true,"vn-762":true,"vn-763":true,"vn-764":false,"vn-765":true});
    for (const id of ["vn-757","vn-762","vn-763","vn-765"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-753 Design System", () => {
const Subject = Subject14;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-754":true,"vn-755":true,"vn-756":true,"vn-757":true,"vn-758":true,"vn-759":true,"vn-761":true,"vn-762":true,"vn-763":true,"vn-764":false,"vn-765":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-753 Design System", () => {
const Subject = Subject14;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-754":true,"vn-755":true,"vn-756":true,"vn-757":true,"vn-758":true,"vn-759":true,"vn-761":true,"vn-762":true,"vn-763":true,"vn-764":true,"vn-765":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-753 Design System", () => {
const Subject = Subject14;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-754":true,"vn-755":true,"vn-756":true,"vn-757":true,"vn-758":true,"vn-759":true,"vn-761":true,"vn-762":true,"vn-763":true,"vn-764":false,"vn-765":true});
    for (const id of ["vn-757","vn-762","vn-763","vn-765"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-753 Design System", () => {
const Subject = Subject14;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-793" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-754":true,"vn-755":true,"vn-756":true,"vn-757":true,"vn-758":true,"vn-759":true,"vn-761":true,"vn-762":true,"vn-763":true,"vn-764":false,"vn-765":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-753 Design System", () => {
const Subject = Subject14;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-794" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-754":true,"vn-755":true,"vn-756":true,"vn-757":true,"vn-758":true,"vn-759":true,"vn-761":true,"vn-762":true,"vn-763":true,"vn-764":false,"vn-765":true}); } finally { wrapper.unmount(); }
});
});
