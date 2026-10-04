// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import Subject0 from "../../../src/generated/presentation/components/details/vp-115.vue";
import Subject1 from "../../../src/generated/presentation/components/details/vp-122.vue";
import Subject2 from "../../../src/generated/presentation/components/details/vp-531.vue";
import Subject3 from "../../../src/generated/presentation/components/details/vp-553.vue";
import Subject4 from "../../../src/generated/presentation/components/details/vp-587.vue";
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
describe("vp-115 Import project JSON", () => {
const Subject = Subject0;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-116":true,"vn-117":true,"vn-118":true,"vn-119":false,"vn-120":false});
  } finally { wrapper.unmount(); }
});
});
describe("vp-115 Import project JSON", () => {
const Subject = Subject0;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-116":true,"vn-117":true,"vn-118":true,"vn-119":false,"vn-120":true});
    for (const id of ["vn-117"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-115 Import project JSON", () => {
const Subject = Subject0;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-116":true,"vn-117":true,"vn-118":true,"vn-119":false,"vn-120":false});
  } finally { wrapper.unmount(); }
});
});
describe("vp-115 Import project JSON", () => {
const Subject = Subject0;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-116":true,"vn-117":true,"vn-118":true,"vn-119":true,"vn-120":false});
  } finally { wrapper.unmount(); }
});
});
describe("vp-115 Import project JSON", () => {
const Subject = Subject0;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-116":true,"vn-117":true,"vn-118":true,"vn-119":false,"vn-120":false});
    for (const id of ["vn-117"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-115 Import project JSON", () => {
const Subject = Subject0;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-1027" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-116":true,"vn-117":true,"vn-118":true,"vn-119":false,"vn-120":false}); } finally { wrapper.unmount(); }
});
});
describe("vp-115 Import project JSON", () => {
const Subject = Subject0;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-1028" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-116":true,"vn-117":true,"vn-118":true,"vn-119":true,"vn-120":false}); } finally { wrapper.unmount(); }
});
});
describe("vp-115 Import project JSON", () => {
const Subject = Subject0;
it("[vi-121] dispatches the designed change interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await fill(wrapper.findAllComponents({ name: "Input" }), "vn-117", "fixture");
    f.reset();
    await wrapper.get("[data-design-node=\"vn-117\"]").trigger("change"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-121"]);
    expect(f.handle.mock.calls.map(([request]) => request.interactionId)).toEqual(["vi-121"]);
    expect(f.navigate).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); }
});
});
describe("vp-122 Component library", () => {
const Subject = Subject1;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-123":true,"vn-124":true,"vn-125":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-122 Component library", () => {
const Subject = Subject1;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-123":true,"vn-124":true,"vn-125":true});
    for (const id of ["vn-125"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-122 Component library", () => {
const Subject = Subject1;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-123":true,"vn-124":true,"vn-125":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-122 Component library", () => {
const Subject = Subject1;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-123":true,"vn-124":true,"vn-125":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-122 Component library", () => {
const Subject = Subject1;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-123":true,"vn-124":true,"vn-125":true});
    for (const id of ["vn-125"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-122 Component library", () => {
const Subject = Subject1;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-1029" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-123":true,"vn-124":true,"vn-125":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-122 Component library", () => {
const Subject = Subject1;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-1030" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-123":true,"vn-124":true,"vn-125":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-122 Component library", () => {
const Subject = Subject1;
it("[vi-127] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-125\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-127"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate.mock.calls.map(([target]) => target)).toEqual(["node-19"]);
  } finally { wrapper.unmount(); }
});
});
describe("vp-531 Project overview", () => {
const Subject = Subject2;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-532":true,"vn-533":true,"vn-534":true,"vn-535":true,"vn-536":true,"vn-544":true,"vn-545":true,"vn-546":true,"vn-547":true,"vn-548":true,"vn-549":true,"vn-537":true,"vn-539":true,"vn-540":true,"vn-541":true,"vn-542":false,"vn-543":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-531 Project overview", () => {
const Subject = Subject2;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-532":true,"vn-533":true,"vn-534":true,"vn-535":true,"vn-536":true,"vn-544":true,"vn-545":true,"vn-546":true,"vn-547":true,"vn-548":true,"vn-549":true,"vn-537":true,"vn-539":true,"vn-540":true,"vn-541":true,"vn-542":false,"vn-543":true});
    for (const id of ["vn-535","vn-540","vn-541","vn-543"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-531 Project overview", () => {
const Subject = Subject2;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-532":true,"vn-533":true,"vn-534":true,"vn-535":true,"vn-536":true,"vn-544":true,"vn-545":true,"vn-546":true,"vn-547":true,"vn-548":true,"vn-549":true,"vn-537":true,"vn-539":true,"vn-540":true,"vn-541":true,"vn-542":false,"vn-543":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-531 Project overview", () => {
const Subject = Subject2;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-532":true,"vn-533":true,"vn-534":true,"vn-535":true,"vn-536":true,"vn-544":true,"vn-545":true,"vn-546":true,"vn-547":true,"vn-548":true,"vn-549":true,"vn-537":true,"vn-539":true,"vn-540":true,"vn-541":true,"vn-542":true,"vn-543":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-531 Project overview", () => {
const Subject = Subject2;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-532":true,"vn-533":true,"vn-534":true,"vn-535":true,"vn-536":true,"vn-544":true,"vn-545":true,"vn-546":true,"vn-547":true,"vn-548":true,"vn-549":true,"vn-537":true,"vn-539":true,"vn-540":true,"vn-541":true,"vn-542":false,"vn-543":true});
    for (const id of ["vn-535","vn-540","vn-541","vn-543"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-531 Project overview", () => {
const Subject = Subject2;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-565" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-532":true,"vn-533":true,"vn-534":true,"vn-535":true,"vn-536":true,"vn-544":true,"vn-545":true,"vn-546":true,"vn-547":true,"vn-548":true,"vn-549":true,"vn-537":true,"vn-539":true,"vn-540":true,"vn-541":true,"vn-542":false,"vn-543":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-531 Project overview", () => {
const Subject = Subject2;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-566" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-532":true,"vn-533":true,"vn-534":true,"vn-535":true,"vn-536":true,"vn-544":true,"vn-545":true,"vn-546":true,"vn-547":true,"vn-548":true,"vn-549":true,"vn-537":true,"vn-539":true,"vn-540":true,"vn-541":true,"vn-542":false,"vn-543":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-531 Project overview", () => {
const Subject = Subject2;
it("scenario Recoverable error renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-567" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-532":true,"vn-533":true,"vn-534":true,"vn-535":true,"vn-536":true,"vn-544":true,"vn-545":true,"vn-546":true,"vn-547":true,"vn-548":true,"vn-549":true,"vn-537":true,"vn-539":true,"vn-540":true,"vn-541":true,"vn-542":true,"vn-543":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-531 Project overview", () => {
const Subject = Subject2;
it("[vi-550] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await fill(wrapper.findAllComponents({ name: "Input" }), "vn-535", "fixture");
    f.reset();
    await wrapper.get("[data-design-node=\"vn-540\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-550"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate.mock.calls.map(([target]) => target)).toEqual(["node-7"]);
  } finally { wrapper.unmount(); }
});
});
describe("vp-531 Project overview", () => {
const Subject = Subject2;
it("[vi-551] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-541\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-551"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expectVisible(wrapper.element, {"vn-532":true,"vn-533":true,"vn-534":true,"vn-535":true,"vn-536":true,"vn-544":true,"vn-545":true,"vn-546":true,"vn-547":true,"vn-548":true,"vn-549":true,"vn-537":true,"vn-539":true,"vn-540":true,"vn-541":true,"vn-542":false,"vn-543":true});
    expect(marked(wrapper.element, "vn-535").contains(document.activeElement)).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-531 Project overview", () => {
const Subject = Subject2;
it("[vi-552] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-543\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-552"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("default");
    expectVisible(wrapper.element, {"vn-532":true,"vn-533":true,"vn-534":true,"vn-535":true,"vn-536":true,"vn-544":true,"vn-545":true,"vn-546":true,"vn-547":true,"vn-548":true,"vn-549":true,"vn-537":true,"vn-539":true,"vn-540":true,"vn-541":true,"vn-542":false,"vn-543":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-553 Project Starters", () => {
const Subject = Subject3;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-554":true,"vn-555":true,"vn-556":true,"vn-557":true,"vn-558":true,"vn-566":true,"vn-567":true,"vn-568":true,"vn-569":true,"vn-570":true,"vn-571":true,"vn-572":true,"vn-573":true,"vn-574":true,"vn-575":true,"vn-576":true,"vn-577":true,"vn-578":true,"vn-579":true,"vn-580":true,"vn-581":true,"vn-582":true,"vn-583":true,"vn-559":true,"vn-561":true,"vn-562":true,"vn-563":true,"vn-564":false,"vn-565":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-553 Project Starters", () => {
const Subject = Subject3;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-554":true,"vn-555":true,"vn-556":true,"vn-557":true,"vn-558":true,"vn-566":true,"vn-567":true,"vn-568":true,"vn-569":true,"vn-570":true,"vn-571":true,"vn-572":true,"vn-573":true,"vn-574":true,"vn-575":true,"vn-576":true,"vn-577":true,"vn-578":true,"vn-579":true,"vn-580":true,"vn-581":true,"vn-582":true,"vn-583":true,"vn-559":true,"vn-561":true,"vn-562":true,"vn-563":true,"vn-564":false,"vn-565":true});
    for (const id of ["vn-557","vn-562","vn-563","vn-565"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-553 Project Starters", () => {
const Subject = Subject3;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-554":true,"vn-555":true,"vn-556":true,"vn-557":true,"vn-558":true,"vn-566":true,"vn-567":true,"vn-568":true,"vn-569":true,"vn-570":true,"vn-571":true,"vn-572":true,"vn-573":true,"vn-574":true,"vn-575":true,"vn-576":true,"vn-577":true,"vn-578":true,"vn-579":true,"vn-580":true,"vn-581":true,"vn-582":true,"vn-583":true,"vn-559":true,"vn-561":true,"vn-562":true,"vn-563":true,"vn-564":false,"vn-565":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-553 Project Starters", () => {
const Subject = Subject3;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-554":true,"vn-555":true,"vn-556":true,"vn-557":true,"vn-558":true,"vn-566":true,"vn-567":true,"vn-568":true,"vn-569":true,"vn-570":true,"vn-571":true,"vn-572":true,"vn-573":true,"vn-574":true,"vn-575":true,"vn-576":true,"vn-577":true,"vn-578":true,"vn-579":true,"vn-580":true,"vn-581":true,"vn-582":true,"vn-583":true,"vn-559":true,"vn-561":true,"vn-562":true,"vn-563":true,"vn-564":true,"vn-565":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-553 Project Starters", () => {
const Subject = Subject3;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-554":true,"vn-555":true,"vn-556":true,"vn-557":true,"vn-558":true,"vn-566":true,"vn-567":true,"vn-568":true,"vn-569":true,"vn-570":true,"vn-571":true,"vn-572":true,"vn-573":true,"vn-574":true,"vn-575":true,"vn-576":true,"vn-577":true,"vn-578":true,"vn-579":true,"vn-580":true,"vn-581":true,"vn-582":true,"vn-583":true,"vn-559":true,"vn-561":true,"vn-562":true,"vn-563":true,"vn-564":false,"vn-565":true});
    for (const id of ["vn-557","vn-562","vn-563","vn-565"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-553 Project Starters", () => {
const Subject = Subject3;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-584" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-554":true,"vn-555":true,"vn-556":true,"vn-557":true,"vn-558":true,"vn-566":true,"vn-567":true,"vn-568":true,"vn-569":true,"vn-570":true,"vn-571":true,"vn-572":true,"vn-573":true,"vn-574":true,"vn-575":true,"vn-576":true,"vn-577":true,"vn-578":true,"vn-579":true,"vn-580":true,"vn-581":true,"vn-582":true,"vn-583":true,"vn-559":true,"vn-561":true,"vn-562":true,"vn-563":true,"vn-564":false,"vn-565":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-553 Project Starters", () => {
const Subject = Subject3;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-585" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-554":true,"vn-555":true,"vn-556":true,"vn-557":true,"vn-558":true,"vn-566":true,"vn-567":true,"vn-568":true,"vn-569":true,"vn-570":true,"vn-571":true,"vn-572":true,"vn-573":true,"vn-574":true,"vn-575":true,"vn-576":true,"vn-577":true,"vn-578":true,"vn-579":true,"vn-580":true,"vn-581":true,"vn-582":true,"vn-583":true,"vn-559":true,"vn-561":true,"vn-562":true,"vn-563":true,"vn-564":false,"vn-565":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-553 Project Starters", () => {
const Subject = Subject3;
it("scenario Recoverable error renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-586" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-554":true,"vn-555":true,"vn-556":true,"vn-557":true,"vn-558":true,"vn-566":true,"vn-567":true,"vn-568":true,"vn-569":true,"vn-570":true,"vn-571":true,"vn-572":true,"vn-573":true,"vn-574":true,"vn-575":true,"vn-576":true,"vn-577":true,"vn-578":true,"vn-579":true,"vn-580":true,"vn-581":true,"vn-582":true,"vn-583":true,"vn-559":true,"vn-561":true,"vn-562":true,"vn-563":true,"vn-564":true,"vn-565":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-553 Project Starters", () => {
const Subject = Subject3;
it("[vi-584] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await fill(wrapper.findAllComponents({ name: "Input" }), "vn-557", "fixture");
    f.reset();
    await wrapper.get("[data-design-node=\"vn-562\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-584"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate.mock.calls.map(([target]) => target)).toEqual(["node-50"]);
  } finally { wrapper.unmount(); }
});
});
describe("vp-553 Project Starters", () => {
const Subject = Subject3;
it("[vi-585] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-563\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-585"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expectVisible(wrapper.element, {"vn-554":true,"vn-555":true,"vn-556":true,"vn-557":true,"vn-558":true,"vn-566":true,"vn-567":true,"vn-568":true,"vn-569":true,"vn-570":true,"vn-571":true,"vn-572":true,"vn-573":true,"vn-574":true,"vn-575":true,"vn-576":true,"vn-577":true,"vn-578":true,"vn-579":true,"vn-580":true,"vn-581":true,"vn-582":true,"vn-583":true,"vn-559":true,"vn-561":true,"vn-562":true,"vn-563":true,"vn-564":false,"vn-565":true});
    expect(marked(wrapper.element, "vn-557").contains(document.activeElement)).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-553 Project Starters", () => {
const Subject = Subject3;
it("[vi-586] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-565\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-586"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("default");
    expectVisible(wrapper.element, {"vn-554":true,"vn-555":true,"vn-556":true,"vn-557":true,"vn-558":true,"vn-566":true,"vn-567":true,"vn-568":true,"vn-569":true,"vn-570":true,"vn-571":true,"vn-572":true,"vn-573":true,"vn-574":true,"vn-575":true,"vn-576":true,"vn-577":true,"vn-578":true,"vn-579":true,"vn-580":true,"vn-581":true,"vn-582":true,"vn-583":true,"vn-559":true,"vn-561":true,"vn-562":true,"vn-563":true,"vn-564":false,"vn-565":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-587 Product requirements", () => {
const Subject = Subject4;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-588":true,"vn-589":true,"vn-590":true,"vn-591":true,"vn-592":true,"vn-593":true,"vn-595":true,"vn-596":true,"vn-597":true,"vn-598":false,"vn-599":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-587 Product requirements", () => {
const Subject = Subject4;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-588":true,"vn-589":true,"vn-590":true,"vn-591":true,"vn-592":true,"vn-593":true,"vn-595":true,"vn-596":true,"vn-597":true,"vn-598":false,"vn-599":true});
    for (const id of ["vn-591","vn-596","vn-597","vn-599"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
