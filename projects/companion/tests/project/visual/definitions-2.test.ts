// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import Subject4 from "../../../src/generated/presentation/components/details/vp-587.vue";
import Subject5 from "../../../src/generated/presentation/components/details/vp-604.vue";
import Subject6 from "../../../src/generated/presentation/components/details/vp-621.vue";
import Subject7 from "../../../src/generated/presentation/components/details/vp-637.vue";
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
describe("vp-587 Product requirements", () => {
const Subject = Subject4;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-588":true,"vn-589":true,"vn-590":true,"vn-591":true,"vn-592":true,"vn-593":true,"vn-595":true,"vn-596":true,"vn-597":true,"vn-598":false,"vn-599":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-587 Product requirements", () => {
const Subject = Subject4;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-588":true,"vn-589":true,"vn-590":true,"vn-591":true,"vn-592":true,"vn-593":true,"vn-595":true,"vn-596":true,"vn-597":true,"vn-598":true,"vn-599":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-587 Product requirements", () => {
const Subject = Subject4;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-588":true,"vn-589":true,"vn-590":true,"vn-591":true,"vn-592":true,"vn-593":true,"vn-595":true,"vn-596":true,"vn-597":true,"vn-598":false,"vn-599":true});
    for (const id of ["vn-591","vn-596","vn-597","vn-599"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-587 Product requirements", () => {
const Subject = Subject4;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-603" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-588":true,"vn-589":true,"vn-590":true,"vn-591":true,"vn-592":true,"vn-593":true,"vn-595":true,"vn-596":true,"vn-597":true,"vn-598":false,"vn-599":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-587 Product requirements", () => {
const Subject = Subject4;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-604" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-588":true,"vn-589":true,"vn-590":true,"vn-591":true,"vn-592":true,"vn-593":true,"vn-595":true,"vn-596":true,"vn-597":true,"vn-598":false,"vn-599":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-587 Product requirements", () => {
const Subject = Subject4;
it("scenario Recoverable error renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-605" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-588":true,"vn-589":true,"vn-590":true,"vn-591":true,"vn-592":true,"vn-593":true,"vn-595":true,"vn-596":true,"vn-597":true,"vn-598":true,"vn-599":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-587 Product requirements", () => {
const Subject = Subject4;
it("[vi-601] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await fill(wrapper.findAllComponents({ name: "Input" }), "vn-591", "fixture");
    f.reset();
    await wrapper.get("[data-design-node=\"vn-596\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-601"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate.mock.calls.map(([target]) => target)).toEqual(["node-9"]);
  } finally { wrapper.unmount(); }
});
});
describe("vp-587 Product requirements", () => {
const Subject = Subject4;
it("[vi-602] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-597\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-602"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expectVisible(wrapper.element, {"vn-588":true,"vn-589":true,"vn-590":true,"vn-591":true,"vn-592":true,"vn-593":true,"vn-595":true,"vn-596":true,"vn-597":true,"vn-598":false,"vn-599":true});
    expect(marked(wrapper.element, "vn-591").contains(document.activeElement)).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-587 Product requirements", () => {
const Subject = Subject4;
it("[vi-603] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-599\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-603"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("default");
    expectVisible(wrapper.element, {"vn-588":true,"vn-589":true,"vn-590":true,"vn-591":true,"vn-592":true,"vn-593":true,"vn-595":true,"vn-596":true,"vn-597":true,"vn-598":false,"vn-599":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-604 Storymaps overview", () => {
const Subject = Subject5;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-605":true,"vn-606":true,"vn-607":true,"vn-608":true,"vn-609":true,"vn-610":true,"vn-612":true,"vn-613":true,"vn-614":true,"vn-615":false,"vn-616":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-604 Storymaps overview", () => {
const Subject = Subject5;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-605":true,"vn-606":true,"vn-607":true,"vn-608":true,"vn-609":true,"vn-610":true,"vn-612":true,"vn-613":true,"vn-614":true,"vn-615":false,"vn-616":true});
    for (const id of ["vn-608","vn-613","vn-614","vn-616"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-604 Storymaps overview", () => {
const Subject = Subject5;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-605":true,"vn-606":true,"vn-607":true,"vn-608":true,"vn-609":true,"vn-610":true,"vn-612":true,"vn-613":true,"vn-614":true,"vn-615":false,"vn-616":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-604 Storymaps overview", () => {
const Subject = Subject5;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-605":true,"vn-606":true,"vn-607":true,"vn-608":true,"vn-609":true,"vn-610":true,"vn-612":true,"vn-613":true,"vn-614":true,"vn-615":true,"vn-616":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-604 Storymaps overview", () => {
const Subject = Subject5;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-605":true,"vn-606":true,"vn-607":true,"vn-608":true,"vn-609":true,"vn-610":true,"vn-612":true,"vn-613":true,"vn-614":true,"vn-615":false,"vn-616":true});
    for (const id of ["vn-608","vn-613","vn-614","vn-616"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-604 Storymaps overview", () => {
const Subject = Subject5;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-622" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-605":true,"vn-606":true,"vn-607":true,"vn-608":true,"vn-609":true,"vn-610":true,"vn-612":true,"vn-613":true,"vn-614":true,"vn-615":false,"vn-616":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-604 Storymaps overview", () => {
const Subject = Subject5;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-623" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-605":true,"vn-606":true,"vn-607":true,"vn-608":true,"vn-609":true,"vn-610":true,"vn-612":true,"vn-613":true,"vn-614":true,"vn-615":false,"vn-616":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-604 Storymaps overview", () => {
const Subject = Subject5;
it("scenario Recoverable error renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-624" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-605":true,"vn-606":true,"vn-607":true,"vn-608":true,"vn-609":true,"vn-610":true,"vn-612":true,"vn-613":true,"vn-614":true,"vn-615":true,"vn-616":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-604 Storymaps overview", () => {
const Subject = Subject5;
it("[vi-618] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await fill(wrapper.findAllComponents({ name: "Input" }), "vn-608", "fixture");
    f.reset();
    await wrapper.get("[data-design-node=\"vn-613\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-618"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate.mock.calls.map(([target]) => target)).toEqual(["node-11"]);
  } finally { wrapper.unmount(); }
});
});
describe("vp-604 Storymaps overview", () => {
const Subject = Subject5;
it("[vi-619] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-614\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-619"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expectVisible(wrapper.element, {"vn-605":true,"vn-606":true,"vn-607":true,"vn-608":true,"vn-609":true,"vn-610":true,"vn-612":true,"vn-613":true,"vn-614":true,"vn-615":false,"vn-616":true});
    expect(marked(wrapper.element, "vn-608").contains(document.activeElement)).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-604 Storymaps overview", () => {
const Subject = Subject5;
it("[vi-620] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-616\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-620"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("default");
    expectVisible(wrapper.element, {"vn-605":true,"vn-606":true,"vn-607":true,"vn-608":true,"vn-609":true,"vn-610":true,"vn-612":true,"vn-613":true,"vn-614":true,"vn-615":false,"vn-616":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-621 Storymap editor", () => {
const Subject = Subject6;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-622":true,"vn-623":true,"vn-624":true,"vn-625":true,"vn-626":true,"vn-627":true,"vn-629":true,"vn-630":true,"vn-631":true,"vn-632":false,"vn-633":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-621 Storymap editor", () => {
const Subject = Subject6;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-622":true,"vn-623":true,"vn-624":true,"vn-625":true,"vn-626":true,"vn-627":true,"vn-629":true,"vn-630":true,"vn-631":true,"vn-632":false,"vn-633":true});
    for (const id of ["vn-625","vn-630","vn-631","vn-633"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-621 Storymap editor", () => {
const Subject = Subject6;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-622":true,"vn-623":true,"vn-624":true,"vn-625":true,"vn-626":true,"vn-627":true,"vn-629":true,"vn-630":true,"vn-631":true,"vn-632":false,"vn-633":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-621 Storymap editor", () => {
const Subject = Subject6;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-622":true,"vn-623":true,"vn-624":true,"vn-625":true,"vn-626":true,"vn-627":true,"vn-629":true,"vn-630":true,"vn-631":true,"vn-632":true,"vn-633":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-621 Storymap editor", () => {
const Subject = Subject6;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-622":true,"vn-623":true,"vn-624":true,"vn-625":true,"vn-626":true,"vn-627":true,"vn-629":true,"vn-630":true,"vn-631":true,"vn-632":false,"vn-633":true});
    for (const id of ["vn-625","vn-630","vn-631","vn-633"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-621 Storymap editor", () => {
const Subject = Subject6;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-641" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-622":true,"vn-623":true,"vn-624":true,"vn-625":true,"vn-626":true,"vn-627":true,"vn-629":true,"vn-630":true,"vn-631":true,"vn-632":false,"vn-633":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-621 Storymap editor", () => {
const Subject = Subject6;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-642" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-622":true,"vn-623":true,"vn-624":true,"vn-625":true,"vn-626":true,"vn-627":true,"vn-629":true,"vn-630":true,"vn-631":true,"vn-632":false,"vn-633":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-621 Storymap editor", () => {
const Subject = Subject6;
it("scenario Recoverable error renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-643" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-622":true,"vn-623":true,"vn-624":true,"vn-625":true,"vn-626":true,"vn-627":true,"vn-629":true,"vn-630":true,"vn-631":true,"vn-632":true,"vn-633":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-621 Storymap editor", () => {
const Subject = Subject6;
it("[vi-634] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await fill(wrapper.findAllComponents({ name: "Input" }), "vn-625", "fixture");
    f.reset();
    await wrapper.get("[data-design-node=\"vn-630\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-634"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate.mock.calls.map(([target]) => target)).toEqual(["node-17"]);
  } finally { wrapper.unmount(); }
});
});
describe("vp-621 Storymap editor", () => {
const Subject = Subject6;
it("[vi-635] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-631\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-635"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expectVisible(wrapper.element, {"vn-622":true,"vn-623":true,"vn-624":true,"vn-625":true,"vn-626":true,"vn-627":true,"vn-629":true,"vn-630":true,"vn-631":true,"vn-632":false,"vn-633":true});
    expect(marked(wrapper.element, "vn-625").contains(document.activeElement)).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-621 Storymap editor", () => {
const Subject = Subject6;
it("[vi-636] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-633\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-636"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("default");
    expectVisible(wrapper.element, {"vn-622":true,"vn-623":true,"vn-624":true,"vn-625":true,"vn-626":true,"vn-627":true,"vn-629":true,"vn-630":true,"vn-631":true,"vn-632":false,"vn-633":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-637 Sitemap & views", () => {
const Subject = Subject7;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-638":true,"vn-639":true,"vn-640":true,"vn-641":true,"vn-642":true,"vn-643":true,"vn-645":true,"vn-646":true,"vn-647":true,"vn-648":false,"vn-649":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-637 Sitemap & views", () => {
const Subject = Subject7;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-638":true,"vn-639":true,"vn-640":true,"vn-641":true,"vn-642":true,"vn-643":true,"vn-645":true,"vn-646":true,"vn-647":true,"vn-648":false,"vn-649":true});
    for (const id of ["vn-641","vn-646","vn-647","vn-649"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-637 Sitemap & views", () => {
const Subject = Subject7;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-638":true,"vn-639":true,"vn-640":true,"vn-641":true,"vn-642":true,"vn-643":true,"vn-645":true,"vn-646":true,"vn-647":true,"vn-648":false,"vn-649":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-637 Sitemap & views", () => {
const Subject = Subject7;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-638":true,"vn-639":true,"vn-640":true,"vn-641":true,"vn-642":true,"vn-643":true,"vn-645":true,"vn-646":true,"vn-647":true,"vn-648":true,"vn-649":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-637 Sitemap & views", () => {
const Subject = Subject7;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-638":true,"vn-639":true,"vn-640":true,"vn-641":true,"vn-642":true,"vn-643":true,"vn-645":true,"vn-646":true,"vn-647":true,"vn-648":false,"vn-649":true});
    for (const id of ["vn-641","vn-646","vn-647","vn-649"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-637 Sitemap & views", () => {
const Subject = Subject7;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-660" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-638":true,"vn-639":true,"vn-640":true,"vn-641":true,"vn-642":true,"vn-643":true,"vn-645":true,"vn-646":true,"vn-647":true,"vn-648":false,"vn-649":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-637 Sitemap & views", () => {
const Subject = Subject7;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-661" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-638":true,"vn-639":true,"vn-640":true,"vn-641":true,"vn-642":true,"vn-643":true,"vn-645":true,"vn-646":true,"vn-647":true,"vn-648":false,"vn-649":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-637 Sitemap & views", () => {
const Subject = Subject7;
it("scenario Recoverable error renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-662" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-638":true,"vn-639":true,"vn-640":true,"vn-641":true,"vn-642":true,"vn-643":true,"vn-645":true,"vn-646":true,"vn-647":true,"vn-648":true,"vn-649":true}); } finally { wrapper.unmount(); }
});
});
