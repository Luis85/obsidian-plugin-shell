// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import Subject21 from "../../../src/generated/presentation/components/details/vp-887.vue";
import Subject22 from "../../../src/generated/presentation/components/details/vp-904.vue";
import Subject23 from "../../../src/generated/presentation/components/details/vp-921.vue";
import Subject24 from "../../../src/generated/presentation/components/details/vp-938.vue";
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
describe("vp-887 Shell capabilities", () => {
const Subject = Subject21;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-927" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-888":true,"vn-889":true,"vn-890":true,"vn-891":true,"vn-892":true,"vn-893":true,"vn-895":true,"vn-896":true,"vn-897":true,"vn-898":false,"vn-899":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-887 Shell capabilities", () => {
const Subject = Subject21;
it("scenario Recoverable error renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-928" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-888":true,"vn-889":true,"vn-890":true,"vn-891":true,"vn-892":true,"vn-893":true,"vn-895":true,"vn-896":true,"vn-897":true,"vn-898":true,"vn-899":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-887 Shell capabilities", () => {
const Subject = Subject21;
it("[vi-901] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await fill(wrapper.findAllComponents({ name: "Input" }), "vn-891", "fixture");
    f.reset();
    await wrapper.get("[data-design-node=\"vn-896\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-901"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate.mock.calls.map(([target]) => target)).toEqual(["node-45"]);
  } finally { wrapper.unmount(); }
});
});
describe("vp-887 Shell capabilities", () => {
const Subject = Subject21;
it("[vi-902] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-897\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-902"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expectVisible(wrapper.element, {"vn-888":true,"vn-889":true,"vn-890":true,"vn-891":true,"vn-892":true,"vn-893":true,"vn-895":true,"vn-896":true,"vn-897":true,"vn-898":false,"vn-899":true});
    expect(marked(wrapper.element, "vn-891").contains(document.activeElement)).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-887 Shell capabilities", () => {
const Subject = Subject21;
it("[vi-903] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-899\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-903"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("default");
    expectVisible(wrapper.element, {"vn-888":true,"vn-889":true,"vn-890":true,"vn-891":true,"vn-892":true,"vn-893":true,"vn-895":true,"vn-896":true,"vn-897":true,"vn-898":false,"vn-899":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-904 Release readiness", () => {
const Subject = Subject22;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-905":true,"vn-906":true,"vn-907":true,"vn-908":true,"vn-909":true,"vn-910":true,"vn-912":true,"vn-913":true,"vn-914":true,"vn-915":false,"vn-916":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-904 Release readiness", () => {
const Subject = Subject22;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-905":true,"vn-906":true,"vn-907":true,"vn-908":true,"vn-909":true,"vn-910":true,"vn-912":true,"vn-913":true,"vn-914":true,"vn-915":false,"vn-916":true});
    for (const id of ["vn-908","vn-913","vn-914","vn-916"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-904 Release readiness", () => {
const Subject = Subject22;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-905":true,"vn-906":true,"vn-907":true,"vn-908":true,"vn-909":true,"vn-910":true,"vn-912":true,"vn-913":true,"vn-914":true,"vn-915":false,"vn-916":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-904 Release readiness", () => {
const Subject = Subject22;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-905":true,"vn-906":true,"vn-907":true,"vn-908":true,"vn-909":true,"vn-910":true,"vn-912":true,"vn-913":true,"vn-914":true,"vn-915":true,"vn-916":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-904 Release readiness", () => {
const Subject = Subject22;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-905":true,"vn-906":true,"vn-907":true,"vn-908":true,"vn-909":true,"vn-910":true,"vn-912":true,"vn-913":true,"vn-914":true,"vn-915":false,"vn-916":true});
    for (const id of ["vn-908","vn-913","vn-914","vn-916"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-904 Release readiness", () => {
const Subject = Subject22;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-945" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-905":true,"vn-906":true,"vn-907":true,"vn-908":true,"vn-909":true,"vn-910":true,"vn-912":true,"vn-913":true,"vn-914":true,"vn-915":false,"vn-916":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-904 Release readiness", () => {
const Subject = Subject22;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-946" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-905":true,"vn-906":true,"vn-907":true,"vn-908":true,"vn-909":true,"vn-910":true,"vn-912":true,"vn-913":true,"vn-914":true,"vn-915":false,"vn-916":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-904 Release readiness", () => {
const Subject = Subject22;
it("scenario Recoverable error renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-947" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-905":true,"vn-906":true,"vn-907":true,"vn-908":true,"vn-909":true,"vn-910":true,"vn-912":true,"vn-913":true,"vn-914":true,"vn-915":true,"vn-916":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-904 Release readiness", () => {
const Subject = Subject22;
it("[vi-918] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await fill(wrapper.findAllComponents({ name: "Input" }), "vn-908", "fixture");
    f.reset();
    await wrapper.get("[data-design-node=\"vn-913\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-918"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate.mock.calls.map(([target]) => target)).toEqual(["node-47"]);
  } finally { wrapper.unmount(); }
});
});
describe("vp-904 Release readiness", () => {
const Subject = Subject22;
it("[vi-919] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-914\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-919"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expectVisible(wrapper.element, {"vn-905":true,"vn-906":true,"vn-907":true,"vn-908":true,"vn-909":true,"vn-910":true,"vn-912":true,"vn-913":true,"vn-914":true,"vn-915":false,"vn-916":true});
    expect(marked(wrapper.element, "vn-908").contains(document.activeElement)).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-904 Release readiness", () => {
const Subject = Subject22;
it("[vi-920] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-916\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-920"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("default");
    expectVisible(wrapper.element, {"vn-905":true,"vn-906":true,"vn-907":true,"vn-908":true,"vn-909":true,"vn-910":true,"vn-912":true,"vn-913":true,"vn-914":true,"vn-915":false,"vn-916":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-921 Runs & recovery", () => {
const Subject = Subject23;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-922":true,"vn-923":true,"vn-924":true,"vn-925":true,"vn-926":true,"vn-927":true,"vn-929":true,"vn-930":true,"vn-931":true,"vn-932":false,"vn-933":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-921 Runs & recovery", () => {
const Subject = Subject23;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-922":true,"vn-923":true,"vn-924":true,"vn-925":true,"vn-926":true,"vn-927":true,"vn-929":true,"vn-930":true,"vn-931":true,"vn-932":false,"vn-933":true});
    for (const id of ["vn-925","vn-930","vn-931","vn-933"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-921 Runs & recovery", () => {
const Subject = Subject23;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-922":true,"vn-923":true,"vn-924":true,"vn-925":true,"vn-926":true,"vn-927":true,"vn-929":true,"vn-930":true,"vn-931":true,"vn-932":false,"vn-933":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-921 Runs & recovery", () => {
const Subject = Subject23;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-922":true,"vn-923":true,"vn-924":true,"vn-925":true,"vn-926":true,"vn-927":true,"vn-929":true,"vn-930":true,"vn-931":true,"vn-932":true,"vn-933":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-921 Runs & recovery", () => {
const Subject = Subject23;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-922":true,"vn-923":true,"vn-924":true,"vn-925":true,"vn-926":true,"vn-927":true,"vn-929":true,"vn-930":true,"vn-931":true,"vn-932":false,"vn-933":true});
    for (const id of ["vn-925","vn-930","vn-931","vn-933"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-921 Runs & recovery", () => {
const Subject = Subject23;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-964" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-922":true,"vn-923":true,"vn-924":true,"vn-925":true,"vn-926":true,"vn-927":true,"vn-929":true,"vn-930":true,"vn-931":true,"vn-932":false,"vn-933":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-921 Runs & recovery", () => {
const Subject = Subject23;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-965" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-922":true,"vn-923":true,"vn-924":true,"vn-925":true,"vn-926":true,"vn-927":true,"vn-929":true,"vn-930":true,"vn-931":true,"vn-932":false,"vn-933":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-921 Runs & recovery", () => {
const Subject = Subject23;
it("scenario Recoverable error renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-966" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-922":true,"vn-923":true,"vn-924":true,"vn-925":true,"vn-926":true,"vn-927":true,"vn-929":true,"vn-930":true,"vn-931":true,"vn-932":true,"vn-933":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-921 Runs & recovery", () => {
const Subject = Subject23;
it("[vi-935] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await fill(wrapper.findAllComponents({ name: "Input" }), "vn-925", "fixture");
    f.reset();
    await wrapper.get("[data-design-node=\"vn-930\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-935"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate.mock.calls.map(([target]) => target)).toEqual(["node-3"]);
  } finally { wrapper.unmount(); }
});
});
describe("vp-921 Runs & recovery", () => {
const Subject = Subject23;
it("[vi-936] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-931\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-936"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expectVisible(wrapper.element, {"vn-922":true,"vn-923":true,"vn-924":true,"vn-925":true,"vn-926":true,"vn-927":true,"vn-929":true,"vn-930":true,"vn-931":true,"vn-932":false,"vn-933":true});
    expect(marked(wrapper.element, "vn-925").contains(document.activeElement)).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-921 Runs & recovery", () => {
const Subject = Subject23;
it("[vi-937] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-933\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-937"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("default");
    expectVisible(wrapper.element, {"vn-922":true,"vn-923":true,"vn-924":true,"vn-925":true,"vn-926":true,"vn-927":true,"vn-929":true,"vn-930":true,"vn-931":true,"vn-932":false,"vn-933":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-938 Workbench preferences", () => {
const Subject = Subject24;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-939":true,"vn-940":true,"vn-941":true,"vn-942":true,"vn-943":true,"vn-944":true,"vn-945":true,"vn-947":true,"vn-948":true,"vn-949":true,"vn-950":false,"vn-951":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-938 Workbench preferences", () => {
const Subject = Subject24;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-939":true,"vn-940":true,"vn-941":true,"vn-942":true,"vn-943":true,"vn-944":true,"vn-945":true,"vn-947":true,"vn-948":true,"vn-949":true,"vn-950":false,"vn-951":true});
    for (const id of ["vn-942","vn-943","vn-944","vn-948","vn-949","vn-951"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-938 Workbench preferences", () => {
const Subject = Subject24;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-939":true,"vn-940":true,"vn-941":true,"vn-942":true,"vn-943":true,"vn-944":true,"vn-945":true,"vn-947":true,"vn-948":true,"vn-949":true,"vn-950":false,"vn-951":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-938 Workbench preferences", () => {
const Subject = Subject24;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-939":true,"vn-940":true,"vn-941":true,"vn-942":true,"vn-943":true,"vn-944":true,"vn-945":true,"vn-947":true,"vn-948":true,"vn-949":true,"vn-950":true,"vn-951":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-938 Workbench preferences", () => {
const Subject = Subject24;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-939":true,"vn-940":true,"vn-941":true,"vn-942":true,"vn-943":true,"vn-944":true,"vn-945":true,"vn-947":true,"vn-948":true,"vn-949":true,"vn-950":false,"vn-951":true});
    for (const id of ["vn-942","vn-943","vn-944","vn-948","vn-949","vn-951"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-938 Workbench preferences", () => {
const Subject = Subject24;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-984" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-939":true,"vn-940":true,"vn-941":true,"vn-942":true,"vn-943":true,"vn-944":true,"vn-945":true,"vn-947":true,"vn-948":true,"vn-949":true,"vn-950":false,"vn-951":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-938 Workbench preferences", () => {
const Subject = Subject24;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-985" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-939":true,"vn-940":true,"vn-941":true,"vn-942":true,"vn-943":true,"vn-944":true,"vn-945":true,"vn-947":true,"vn-948":true,"vn-949":true,"vn-950":false,"vn-951":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-938 Workbench preferences", () => {
const Subject = Subject24;
it("scenario Recoverable error renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-986" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-939":true,"vn-940":true,"vn-941":true,"vn-942":true,"vn-943":true,"vn-944":true,"vn-945":true,"vn-947":true,"vn-948":true,"vn-949":true,"vn-950":true,"vn-951":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-938 Workbench preferences", () => {
const Subject = Subject24;
it("[vi-952] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await fill(wrapper.findAllComponents({ name: "Input" }), "vn-942", "fixture");
    await fill(wrapper.findAllComponents({ name: "Input" }), "vn-943", "fixture");
    await fill(wrapper.findAllComponents({ name: "Input" }), "vn-944", "fixture");
    f.reset();
    await wrapper.get("[data-design-node=\"vn-948\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-952"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate.mock.calls.map(([target]) => target)).toEqual(["node-35"]);
  } finally { wrapper.unmount(); }
});
});
describe("vp-938 Workbench preferences", () => {
const Subject = Subject24;
it("[vi-953] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-949\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-953"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expectVisible(wrapper.element, {"vn-939":true,"vn-940":true,"vn-941":true,"vn-942":true,"vn-943":true,"vn-944":true,"vn-945":true,"vn-947":true,"vn-948":true,"vn-949":true,"vn-950":false,"vn-951":true});
    expect(marked(wrapper.element, "vn-942").contains(document.activeElement)).toBe(true);
  } finally { wrapper.unmount(); }
});
});
