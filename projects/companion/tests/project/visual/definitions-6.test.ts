// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import Subject18 from "../../../src/generated/presentation/components/details/vp-831.vue";
import Subject19 from "../../../src/generated/presentation/components/details/vp-848.vue";
import Subject20 from "../../../src/generated/presentation/components/details/vp-870.vue";
import Subject21 from "../../../src/generated/presentation/components/details/vp-887.vue";
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
describe("vp-831 Generate a feature", () => {
const Subject = Subject18;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-832":true,"vn-833":true,"vn-834":true,"vn-835":true,"vn-836":true,"vn-837":true,"vn-839":true,"vn-840":true,"vn-841":true,"vn-842":false,"vn-843":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-831 Generate a feature", () => {
const Subject = Subject18;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-832":true,"vn-833":true,"vn-834":true,"vn-835":true,"vn-836":true,"vn-837":true,"vn-839":true,"vn-840":true,"vn-841":true,"vn-842":false,"vn-843":true});
    for (const id of ["vn-835","vn-840","vn-841","vn-843"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-831 Generate a feature", () => {
const Subject = Subject18;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-832":true,"vn-833":true,"vn-834":true,"vn-835":true,"vn-836":true,"vn-837":true,"vn-839":true,"vn-840":true,"vn-841":true,"vn-842":false,"vn-843":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-831 Generate a feature", () => {
const Subject = Subject18;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-832":true,"vn-833":true,"vn-834":true,"vn-835":true,"vn-836":true,"vn-837":true,"vn-839":true,"vn-840":true,"vn-841":true,"vn-842":true,"vn-843":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-831 Generate a feature", () => {
const Subject = Subject18;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-832":true,"vn-833":true,"vn-834":true,"vn-835":true,"vn-836":true,"vn-837":true,"vn-839":true,"vn-840":true,"vn-841":true,"vn-842":false,"vn-843":true});
    for (const id of ["vn-835","vn-840","vn-841","vn-843"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-831 Generate a feature", () => {
const Subject = Subject18;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-869" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-832":true,"vn-833":true,"vn-834":true,"vn-835":true,"vn-836":true,"vn-837":true,"vn-839":true,"vn-840":true,"vn-841":true,"vn-842":false,"vn-843":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-831 Generate a feature", () => {
const Subject = Subject18;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-870" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-832":true,"vn-833":true,"vn-834":true,"vn-835":true,"vn-836":true,"vn-837":true,"vn-839":true,"vn-840":true,"vn-841":true,"vn-842":false,"vn-843":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-831 Generate a feature", () => {
const Subject = Subject18;
it("scenario Recoverable error renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-871" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-832":true,"vn-833":true,"vn-834":true,"vn-835":true,"vn-836":true,"vn-837":true,"vn-839":true,"vn-840":true,"vn-841":true,"vn-842":true,"vn-843":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-831 Generate a feature", () => {
const Subject = Subject18;
it("[vi-845] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await fill(wrapper.findAllComponents({ name: "Input" }), "vn-835", "fixture");
    f.reset();
    await wrapper.get("[data-design-node=\"vn-840\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-845"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate.mock.calls.map(([target]) => target)).toEqual(["node-39"]);
  } finally { wrapper.unmount(); }
});
});
describe("vp-831 Generate a feature", () => {
const Subject = Subject18;
it("[vi-846] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-841\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-846"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expectVisible(wrapper.element, {"vn-832":true,"vn-833":true,"vn-834":true,"vn-835":true,"vn-836":true,"vn-837":true,"vn-839":true,"vn-840":true,"vn-841":true,"vn-842":false,"vn-843":true});
    expect(marked(wrapper.element, "vn-835").contains(document.activeElement)).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-831 Generate a feature", () => {
const Subject = Subject18;
it("[vi-847] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-843\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-847"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("default");
    expectVisible(wrapper.element, {"vn-832":true,"vn-833":true,"vn-834":true,"vn-835":true,"vn-836":true,"vn-837":true,"vn-839":true,"vn-840":true,"vn-841":true,"vn-842":false,"vn-843":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-848 Development", () => {
const Subject = Subject19;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-849":true,"vn-850":true,"vn-851":true,"vn-852":true,"vn-853":true,"vn-861":true,"vn-862":true,"vn-863":true,"vn-864":true,"vn-865":true,"vn-866":true,"vn-854":true,"vn-856":true,"vn-857":true,"vn-858":true,"vn-859":false,"vn-860":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-848 Development", () => {
const Subject = Subject19;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-849":true,"vn-850":true,"vn-851":true,"vn-852":true,"vn-853":true,"vn-861":true,"vn-862":true,"vn-863":true,"vn-864":true,"vn-865":true,"vn-866":true,"vn-854":true,"vn-856":true,"vn-857":true,"vn-858":true,"vn-859":false,"vn-860":true});
    for (const id of ["vn-852","vn-857","vn-858","vn-860"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-848 Development", () => {
const Subject = Subject19;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-849":true,"vn-850":true,"vn-851":true,"vn-852":true,"vn-853":true,"vn-861":true,"vn-862":true,"vn-863":true,"vn-864":true,"vn-865":true,"vn-866":true,"vn-854":true,"vn-856":true,"vn-857":true,"vn-858":true,"vn-859":false,"vn-860":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-848 Development", () => {
const Subject = Subject19;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-849":true,"vn-850":true,"vn-851":true,"vn-852":true,"vn-853":true,"vn-861":true,"vn-862":true,"vn-863":true,"vn-864":true,"vn-865":true,"vn-866":true,"vn-854":true,"vn-856":true,"vn-857":true,"vn-858":true,"vn-859":true,"vn-860":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-848 Development", () => {
const Subject = Subject19;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-849":true,"vn-850":true,"vn-851":true,"vn-852":true,"vn-853":true,"vn-861":true,"vn-862":true,"vn-863":true,"vn-864":true,"vn-865":true,"vn-866":true,"vn-854":true,"vn-856":true,"vn-857":true,"vn-858":true,"vn-859":false,"vn-860":true});
    for (const id of ["vn-852","vn-857","vn-858","vn-860"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-848 Development", () => {
const Subject = Subject19;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-888" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-849":true,"vn-850":true,"vn-851":true,"vn-852":true,"vn-853":true,"vn-861":true,"vn-862":true,"vn-863":true,"vn-864":true,"vn-865":true,"vn-866":true,"vn-854":true,"vn-856":true,"vn-857":true,"vn-858":true,"vn-859":false,"vn-860":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-848 Development", () => {
const Subject = Subject19;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-889" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-849":true,"vn-850":true,"vn-851":true,"vn-852":true,"vn-853":true,"vn-861":true,"vn-862":true,"vn-863":true,"vn-864":true,"vn-865":true,"vn-866":true,"vn-854":true,"vn-856":true,"vn-857":true,"vn-858":true,"vn-859":false,"vn-860":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-848 Development", () => {
const Subject = Subject19;
it("scenario Recoverable error renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-890" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-849":true,"vn-850":true,"vn-851":true,"vn-852":true,"vn-853":true,"vn-861":true,"vn-862":true,"vn-863":true,"vn-864":true,"vn-865":true,"vn-866":true,"vn-854":true,"vn-856":true,"vn-857":true,"vn-858":true,"vn-859":true,"vn-860":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-848 Development", () => {
const Subject = Subject19;
it("[vi-867] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await fill(wrapper.findAllComponents({ name: "Input" }), "vn-852", "fixture");
    f.reset();
    await wrapper.get("[data-design-node=\"vn-857\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-867"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate.mock.calls.map(([target]) => target)).toEqual(["node-41"]);
  } finally { wrapper.unmount(); }
});
});
describe("vp-848 Development", () => {
const Subject = Subject19;
it("[vi-868] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-858\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-868"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expectVisible(wrapper.element, {"vn-849":true,"vn-850":true,"vn-851":true,"vn-852":true,"vn-853":true,"vn-861":true,"vn-862":true,"vn-863":true,"vn-864":true,"vn-865":true,"vn-866":true,"vn-854":true,"vn-856":true,"vn-857":true,"vn-858":true,"vn-859":false,"vn-860":true});
    expect(marked(wrapper.element, "vn-852").contains(document.activeElement)).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-848 Development", () => {
const Subject = Subject19;
it("[vi-869] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-860\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-869"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("default");
    expectVisible(wrapper.element, {"vn-849":true,"vn-850":true,"vn-851":true,"vn-852":true,"vn-853":true,"vn-861":true,"vn-862":true,"vn-863":true,"vn-864":true,"vn-865":true,"vn-866":true,"vn-854":true,"vn-856":true,"vn-857":true,"vn-858":true,"vn-859":false,"vn-860":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-870 Quality & verification", () => {
const Subject = Subject20;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-871":true,"vn-872":true,"vn-873":true,"vn-874":true,"vn-875":true,"vn-876":true,"vn-878":true,"vn-879":true,"vn-880":true,"vn-881":false,"vn-882":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-870 Quality & verification", () => {
const Subject = Subject20;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-871":true,"vn-872":true,"vn-873":true,"vn-874":true,"vn-875":true,"vn-876":true,"vn-878":true,"vn-879":true,"vn-880":true,"vn-881":false,"vn-882":true});
    for (const id of ["vn-874","vn-879","vn-880","vn-882"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-870 Quality & verification", () => {
const Subject = Subject20;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-871":true,"vn-872":true,"vn-873":true,"vn-874":true,"vn-875":true,"vn-876":true,"vn-878":true,"vn-879":true,"vn-880":true,"vn-881":false,"vn-882":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-870 Quality & verification", () => {
const Subject = Subject20;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-871":true,"vn-872":true,"vn-873":true,"vn-874":true,"vn-875":true,"vn-876":true,"vn-878":true,"vn-879":true,"vn-880":true,"vn-881":true,"vn-882":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-870 Quality & verification", () => {
const Subject = Subject20;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-871":true,"vn-872":true,"vn-873":true,"vn-874":true,"vn-875":true,"vn-876":true,"vn-878":true,"vn-879":true,"vn-880":true,"vn-881":false,"vn-882":true});
    for (const id of ["vn-874","vn-879","vn-880","vn-882"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-870 Quality & verification", () => {
const Subject = Subject20;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-907" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-871":true,"vn-872":true,"vn-873":true,"vn-874":true,"vn-875":true,"vn-876":true,"vn-878":true,"vn-879":true,"vn-880":true,"vn-881":false,"vn-882":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-870 Quality & verification", () => {
const Subject = Subject20;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-908" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-871":true,"vn-872":true,"vn-873":true,"vn-874":true,"vn-875":true,"vn-876":true,"vn-878":true,"vn-879":true,"vn-880":true,"vn-881":false,"vn-882":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-870 Quality & verification", () => {
const Subject = Subject20;
it("scenario Recoverable error renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-909" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-871":true,"vn-872":true,"vn-873":true,"vn-874":true,"vn-875":true,"vn-876":true,"vn-878":true,"vn-879":true,"vn-880":true,"vn-881":true,"vn-882":true}); } finally { wrapper.unmount(); }
});
});
describe("vp-870 Quality & verification", () => {
const Subject = Subject20;
it("[vi-884] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await fill(wrapper.findAllComponents({ name: "Input" }), "vn-874", "fixture");
    f.reset();
    await wrapper.get("[data-design-node=\"vn-879\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-884"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate.mock.calls.map(([target]) => target)).toEqual(["node-43"]);
  } finally { wrapper.unmount(); }
});
});
describe("vp-870 Quality & verification", () => {
const Subject = Subject20;
it("[vi-885] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-880\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-885"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expectVisible(wrapper.element, {"vn-871":true,"vn-872":true,"vn-873":true,"vn-874":true,"vn-875":true,"vn-876":true,"vn-878":true,"vn-879":true,"vn-880":true,"vn-881":false,"vn-882":true});
    expect(marked(wrapper.element, "vn-874").contains(document.activeElement)).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-870 Quality & verification", () => {
const Subject = Subject20;
it("[vi-886] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-882\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-886"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("default");
    expectVisible(wrapper.element, {"vn-871":true,"vn-872":true,"vn-873":true,"vn-874":true,"vn-875":true,"vn-876":true,"vn-878":true,"vn-879":true,"vn-880":true,"vn-881":false,"vn-882":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-887 Shell capabilities", () => {
const Subject = Subject21;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-888":true,"vn-889":true,"vn-890":true,"vn-891":true,"vn-892":true,"vn-893":true,"vn-895":true,"vn-896":true,"vn-897":true,"vn-898":false,"vn-899":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-887 Shell capabilities", () => {
const Subject = Subject21;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-888":true,"vn-889":true,"vn-890":true,"vn-891":true,"vn-892":true,"vn-893":true,"vn-895":true,"vn-896":true,"vn-897":true,"vn-898":false,"vn-899":true});
    for (const id of ["vn-891","vn-896","vn-897","vn-899"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-887 Shell capabilities", () => {
const Subject = Subject21;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-888":true,"vn-889":true,"vn-890":true,"vn-891":true,"vn-892":true,"vn-893":true,"vn-895":true,"vn-896":true,"vn-897":true,"vn-898":false,"vn-899":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-887 Shell capabilities", () => {
const Subject = Subject21;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-888":true,"vn-889":true,"vn-890":true,"vn-891":true,"vn-892":true,"vn-893":true,"vn-895":true,"vn-896":true,"vn-897":true,"vn-898":true,"vn-899":true});
  } finally { wrapper.unmount(); }
});
});
describe("vp-887 Shell capabilities", () => {
const Subject = Subject21;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-888":true,"vn-889":true,"vn-890":true,"vn-891":true,"vn-892":true,"vn-893":true,"vn-895":true,"vn-896":true,"vn-897":true,"vn-898":false,"vn-899":true});
    for (const id of ["vn-891","vn-896","vn-897","vn-899"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vp-887 Shell capabilities", () => {
const Subject = Subject21;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{}, designScenario: "scenario-926" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-888":true,"vn-889":true,"vn-890":true,"vn-891":true,"vn-892":true,"vn-893":true,"vn-895":true,"vn-896":true,"vn-897":true,"vn-898":false,"vn-899":true}); } finally { wrapper.unmount(); }
});
});
