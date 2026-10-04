// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import Subject14 from "../../../src/generated/presentation/components/details/vp-753.vue";
import Subject15 from "../../../src/generated/presentation/components/details/vp-770.vue";
import Subject16 from "../../../src/generated/presentation/components/details/vp-792.vue";
import Subject17 from "../../../src/generated/presentation/components/details/vp-814.vue";
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
describe("vp-753 Design System", () => {
const Subject = Subject14;
it("scenario Recoverable error renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-795" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-754":true,"vn-755":true,"vn-756":true,"vn-757":true,"vn-758":true,"vn-759":true,"vn-761":true,"vn-762":true,"vn-763":true,"vn-764":true,"vn-765":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-753 Design System", () => {
const Subject = Subject14;
it("[vi-767] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await fill(wrapper.findAllComponents({ name: "Input" }), "vn-757", "fixture");
    f.reset();
    await wrapper.get("[data-design-node=\"vn-762\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-767"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate.mock.calls.map(([target]) => target)).toEqual(["node-29"]);
  } finally { wrapper.unmount(); }
});
});
describe("vp-753 Design System", () => {
const Subject = Subject14;
it("[vi-768] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-763\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-768"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expectVisible(wrapper.element, {"vn-754":true,"vn-755":true,"vn-756":true,"vn-757":true,"vn-758":true,"vn-759":true,"vn-761":true,"vn-762":true,"vn-763":true,"vn-764":false,"vn-765":true});
    expect(marked(wrapper.element, "vn-757").contains(document.activeElement)).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-753 Design System", () => {
const Subject = Subject14;
it("[vi-769] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-765\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-769"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("default");
    expectVisible(wrapper.element, {"vn-754":true,"vn-755":true,"vn-756":true,"vn-757":true,"vn-758":true,"vn-759":true,"vn-761":true,"vn-762":true,"vn-763":true,"vn-764":false,"vn-765":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-770 Blueprints", () => {
const Subject = Subject15;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-771":true,"vn-772":true,"vn-773":true,"vn-774":true,"vn-775":true,"vn-783":true,"vn-784":true,"vn-785":true,"vn-786":true,"vn-787":true,"vn-788":true,"vn-776":true,"vn-778":true,"vn-779":true,"vn-780":true,"vn-781":false,"vn-782":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-770 Blueprints", () => {
const Subject = Subject15;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-771":true,"vn-772":true,"vn-773":true,"vn-774":true,"vn-775":true,"vn-783":true,"vn-784":true,"vn-785":true,"vn-786":true,"vn-787":true,"vn-788":true,"vn-776":true,"vn-778":true,"vn-779":true,"vn-780":true,"vn-781":false,"vn-782":true});
    for (const id of ["vn-774","vn-779","vn-780","vn-782"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-770 Blueprints", () => {
const Subject = Subject15;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-771":true,"vn-772":true,"vn-773":true,"vn-774":true,"vn-775":true,"vn-783":true,"vn-784":true,"vn-785":true,"vn-786":true,"vn-787":true,"vn-788":true,"vn-776":true,"vn-778":true,"vn-779":true,"vn-780":true,"vn-781":false,"vn-782":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-770 Blueprints", () => {
const Subject = Subject15;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-771":true,"vn-772":true,"vn-773":true,"vn-774":true,"vn-775":true,"vn-783":true,"vn-784":true,"vn-785":true,"vn-786":true,"vn-787":true,"vn-788":true,"vn-776":true,"vn-778":true,"vn-779":true,"vn-780":true,"vn-781":true,"vn-782":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-770 Blueprints", () => {
const Subject = Subject15;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-771":true,"vn-772":true,"vn-773":true,"vn-774":true,"vn-775":true,"vn-783":true,"vn-784":true,"vn-785":true,"vn-786":true,"vn-787":true,"vn-788":true,"vn-776":true,"vn-778":true,"vn-779":true,"vn-780":true,"vn-781":false,"vn-782":true});
    for (const id of ["vn-774","vn-779","vn-780","vn-782"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-770 Blueprints", () => {
const Subject = Subject15;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-812" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-771":true,"vn-772":true,"vn-773":true,"vn-774":true,"vn-775":true,"vn-783":true,"vn-784":true,"vn-785":true,"vn-786":true,"vn-787":true,"vn-788":true,"vn-776":true,"vn-778":true,"vn-779":true,"vn-780":true,"vn-781":false,"vn-782":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-770 Blueprints", () => {
const Subject = Subject15;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-813" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-771":true,"vn-772":true,"vn-773":true,"vn-774":true,"vn-775":true,"vn-783":true,"vn-784":true,"vn-785":true,"vn-786":true,"vn-787":true,"vn-788":true,"vn-776":true,"vn-778":true,"vn-779":true,"vn-780":true,"vn-781":false,"vn-782":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-770 Blueprints", () => {
const Subject = Subject15;
it("scenario Recoverable error renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-814" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-771":true,"vn-772":true,"vn-773":true,"vn-774":true,"vn-775":true,"vn-783":true,"vn-784":true,"vn-785":true,"vn-786":true,"vn-787":true,"vn-788":true,"vn-776":true,"vn-778":true,"vn-779":true,"vn-780":true,"vn-781":true,"vn-782":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-770 Blueprints", () => {
const Subject = Subject15;
it("[vi-789] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await fill(wrapper.findAllComponents({ name: "Input" }), "vn-774", "fixture");
    f.reset();
    await wrapper.get("[data-design-node=\"vn-779\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-789"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate.mock.calls.map(([target]) => target)).toEqual(["node-13"]);
  } finally { wrapper.unmount(); }
});
});
describe("vp-770 Blueprints", () => {
const Subject = Subject15;
it("[vi-790] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-780\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-790"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expectVisible(wrapper.element, {"vn-771":true,"vn-772":true,"vn-773":true,"vn-774":true,"vn-775":true,"vn-783":true,"vn-784":true,"vn-785":true,"vn-786":true,"vn-787":true,"vn-788":true,"vn-776":true,"vn-778":true,"vn-779":true,"vn-780":true,"vn-781":false,"vn-782":true});
    expect(marked(wrapper.element, "vn-774").contains(document.activeElement)).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-770 Blueprints", () => {
const Subject = Subject15;
it("[vi-791] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-782\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-791"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("default");
    expectVisible(wrapper.element, {"vn-771":true,"vn-772":true,"vn-773":true,"vn-774":true,"vn-775":true,"vn-783":true,"vn-784":true,"vn-785":true,"vn-786":true,"vn-787":true,"vn-788":true,"vn-776":true,"vn-778":true,"vn-779":true,"vn-780":true,"vn-781":false,"vn-782":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-792 Action patterns", () => {
const Subject = Subject16;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-793":true,"vn-794":true,"vn-795":true,"vn-796":true,"vn-797":true,"vn-805":true,"vn-806":true,"vn-807":true,"vn-808":true,"vn-809":true,"vn-810":true,"vn-798":true,"vn-800":true,"vn-801":true,"vn-802":true,"vn-803":false,"vn-804":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-792 Action patterns", () => {
const Subject = Subject16;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-793":true,"vn-794":true,"vn-795":true,"vn-796":true,"vn-797":true,"vn-805":true,"vn-806":true,"vn-807":true,"vn-808":true,"vn-809":true,"vn-810":true,"vn-798":true,"vn-800":true,"vn-801":true,"vn-802":true,"vn-803":false,"vn-804":true});
    for (const id of ["vn-796","vn-801","vn-802","vn-804"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-792 Action patterns", () => {
const Subject = Subject16;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-793":true,"vn-794":true,"vn-795":true,"vn-796":true,"vn-797":true,"vn-805":true,"vn-806":true,"vn-807":true,"vn-808":true,"vn-809":true,"vn-810":true,"vn-798":true,"vn-800":true,"vn-801":true,"vn-802":true,"vn-803":false,"vn-804":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-792 Action patterns", () => {
const Subject = Subject16;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-793":true,"vn-794":true,"vn-795":true,"vn-796":true,"vn-797":true,"vn-805":true,"vn-806":true,"vn-807":true,"vn-808":true,"vn-809":true,"vn-810":true,"vn-798":true,"vn-800":true,"vn-801":true,"vn-802":true,"vn-803":true,"vn-804":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-792 Action patterns", () => {
const Subject = Subject16;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-793":true,"vn-794":true,"vn-795":true,"vn-796":true,"vn-797":true,"vn-805":true,"vn-806":true,"vn-807":true,"vn-808":true,"vn-809":true,"vn-810":true,"vn-798":true,"vn-800":true,"vn-801":true,"vn-802":true,"vn-803":false,"vn-804":true});
    for (const id of ["vn-796","vn-801","vn-802","vn-804"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-792 Action patterns", () => {
const Subject = Subject16;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-831" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-793":true,"vn-794":true,"vn-795":true,"vn-796":true,"vn-797":true,"vn-805":true,"vn-806":true,"vn-807":true,"vn-808":true,"vn-809":true,"vn-810":true,"vn-798":true,"vn-800":true,"vn-801":true,"vn-802":true,"vn-803":false,"vn-804":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-792 Action patterns", () => {
const Subject = Subject16;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-832" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-793":true,"vn-794":true,"vn-795":true,"vn-796":true,"vn-797":true,"vn-805":true,"vn-806":true,"vn-807":true,"vn-808":true,"vn-809":true,"vn-810":true,"vn-798":true,"vn-800":true,"vn-801":true,"vn-802":true,"vn-803":false,"vn-804":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-792 Action patterns", () => {
const Subject = Subject16;
it("scenario Recoverable error renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-833" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-793":true,"vn-794":true,"vn-795":true,"vn-796":true,"vn-797":true,"vn-805":true,"vn-806":true,"vn-807":true,"vn-808":true,"vn-809":true,"vn-810":true,"vn-798":true,"vn-800":true,"vn-801":true,"vn-802":true,"vn-803":true,"vn-804":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-792 Action patterns", () => {
const Subject = Subject16;
it("[vi-811] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await fill(wrapper.findAllComponents({ name: "Input" }), "vn-796", "fixture");
    f.reset();
    await wrapper.get("[data-design-node=\"vn-801\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-811"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate.mock.calls.map(([target]) => target)).toEqual(["node-13"]);
  } finally { wrapper.unmount(); }
});
});
describe("vp-792 Action patterns", () => {
const Subject = Subject16;
it("[vi-812] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-802\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-812"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expectVisible(wrapper.element, {"vn-793":true,"vn-794":true,"vn-795":true,"vn-796":true,"vn-797":true,"vn-805":true,"vn-806":true,"vn-807":true,"vn-808":true,"vn-809":true,"vn-810":true,"vn-798":true,"vn-800":true,"vn-801":true,"vn-802":true,"vn-803":false,"vn-804":true});
    expect(marked(wrapper.element, "vn-796").contains(document.activeElement)).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-792 Action patterns", () => {
const Subject = Subject16;
it("[vi-813] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-804\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-813"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("default");
    expectVisible(wrapper.element, {"vn-793":true,"vn-794":true,"vn-795":true,"vn-796":true,"vn-797":true,"vn-805":true,"vn-806":true,"vn-807":true,"vn-808":true,"vn-809":true,"vn-810":true,"vn-798":true,"vn-800":true,"vn-801":true,"vn-802":true,"vn-803":false,"vn-804":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-814 Prepare project", () => {
const Subject = Subject17;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-815":true,"vn-816":true,"vn-817":true,"vn-818":true,"vn-819":true,"vn-820":true,"vn-822":true,"vn-823":true,"vn-824":true,"vn-825":false,"vn-826":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-814 Prepare project", () => {
const Subject = Subject17;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-815":true,"vn-816":true,"vn-817":true,"vn-818":true,"vn-819":true,"vn-820":true,"vn-822":true,"vn-823":true,"vn-824":true,"vn-825":false,"vn-826":true});
    for (const id of ["vn-818","vn-823","vn-824","vn-826"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-814 Prepare project", () => {
const Subject = Subject17;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-815":true,"vn-816":true,"vn-817":true,"vn-818":true,"vn-819":true,"vn-820":true,"vn-822":true,"vn-823":true,"vn-824":true,"vn-825":false,"vn-826":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-814 Prepare project", () => {
const Subject = Subject17;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-815":true,"vn-816":true,"vn-817":true,"vn-818":true,"vn-819":true,"vn-820":true,"vn-822":true,"vn-823":true,"vn-824":true,"vn-825":true,"vn-826":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-814 Prepare project", () => {
const Subject = Subject17;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-815":true,"vn-816":true,"vn-817":true,"vn-818":true,"vn-819":true,"vn-820":true,"vn-822":true,"vn-823":true,"vn-824":true,"vn-825":false,"vn-826":true});
    for (const id of ["vn-818","vn-823","vn-824","vn-826"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-814 Prepare project", () => {
const Subject = Subject17;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-850" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-815":true,"vn-816":true,"vn-817":true,"vn-818":true,"vn-819":true,"vn-820":true,"vn-822":true,"vn-823":true,"vn-824":true,"vn-825":false,"vn-826":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-814 Prepare project", () => {
const Subject = Subject17;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-851" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-815":true,"vn-816":true,"vn-817":true,"vn-818":true,"vn-819":true,"vn-820":true,"vn-822":true,"vn-823":true,"vn-824":true,"vn-825":false,"vn-826":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-814 Prepare project", () => {
const Subject = Subject17;
it("scenario Recoverable error renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-852" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-815":true,"vn-816":true,"vn-817":true,"vn-818":true,"vn-819":true,"vn-820":true,"vn-822":true,"vn-823":true,"vn-824":true,"vn-825":true,"vn-826":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-814 Prepare project", () => {
const Subject = Subject17;
it("[vi-828] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await fill(wrapper.findAllComponents({ name: "Input" }), "vn-818", "fixture");
    f.reset();
    await wrapper.get("[data-design-node=\"vn-823\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-828"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate.mock.calls.map(([target]) => target)).toEqual(["node-37"]);
  } finally { wrapper.unmount(); }
});
});
describe("vp-814 Prepare project", () => {
const Subject = Subject17;
it("[vi-829] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-824\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-829"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expectVisible(wrapper.element, {"vn-815":true,"vn-816":true,"vn-817":true,"vn-818":true,"vn-819":true,"vn-820":true,"vn-822":true,"vn-823":true,"vn-824":true,"vn-825":false,"vn-826":true});
    expect(marked(wrapper.element, "vn-818").contains(document.activeElement)).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-814 Prepare project", () => {
const Subject = Subject17;
it("[vi-830] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-826\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-830"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("default");
    expectVisible(wrapper.element, {"vn-815":true,"vn-816":true,"vn-817":true,"vn-818":true,"vn-819":true,"vn-820":true,"vn-822":true,"vn-823":true,"vn-824":true,"vn-825":false,"vn-826":true});
  } finally { wrapper.unmount(); }
});
});
