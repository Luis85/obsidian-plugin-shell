// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import Subject72 from "../../../src/generated/presentation/components/library/review-findings.vue";
import Subject73 from "../../../src/generated/presentation/components/library/requirements-panel.vue";
import Subject74 from "../../../src/generated/presentation/components/library/diagram-inspector.vue";
import Subject75 from "../../../src/generated/presentation/components/library/source-operation-editor.vue";
import Subject76 from "../../../src/generated/presentation/components/library/test-operation-panel.vue";
import { visualKey, type VisualContext } from "../../../src/generated/presentation/composables/use-visual.ts";
import type { VisualRequest } from "../../../src/generated/domain/visual-runtime.ts";
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
describe("vc-100 ReviewFindings", () => {
const Subject = Subject72;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-473":true,"vn-474":true,"vn-475":true,"vn-476":true,"vn-479":true,"vn-477":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-100 ReviewFindings", () => {
const Subject = Subject72;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-473":true,"vn-474":true,"vn-475":true,"vn-476":true,"vn-479":true,"vn-477":true});
    for (const id of ["vn-477"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-100 ReviewFindings", () => {
const Subject = Subject72;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-473":true,"vn-474":true,"vn-475":true,"vn-476":true,"vn-479":true,"vn-477":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-100 ReviewFindings", () => {
const Subject = Subject72;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-473":true,"vn-474":true,"vn-475":true,"vn-476":true,"vn-479":true,"vn-477":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-100 ReviewFindings", () => {
const Subject = Subject72;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-473":true,"vn-474":true,"vn-475":true,"vn-476":true,"vn-479":true,"vn-477":true});
    for (const id of ["vn-477"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-100 ReviewFindings", () => {
const Subject = Subject72;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designScenario: "scenario-476" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-473":true,"vn-474":true,"vn-475":true,"vn-476":true,"vn-479":true,"vn-477":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-100 ReviewFindings", () => {
const Subject = Subject72;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designScenario: "scenario-477" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-473":true,"vn-474":true,"vn-475":true,"vn-476":true,"vn-479":true,"vn-477":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-100 ReviewFindings", () => {
const Subject = Subject72;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designScenario: "scenario-478" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-473":true,"vn-474":true,"vn-475":true,"vn-476":true,"vn-479":true,"vn-477":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-100 ReviewFindings", () => {
const Subject = Subject72;
it("[vi-480] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture","busy":false}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-477\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-480"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-473":true,"vn-474":true,"vn-475":true,"vn-476":true,"vn-479":true,"vn-477":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-101 RequirementsPanel", () => {
const Subject = Subject73;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-481":true,"vn-482":true,"vn-483":true,"vn-484":true,"vn-487":true,"vn-485":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-101 RequirementsPanel", () => {
const Subject = Subject73;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-481":true,"vn-482":true,"vn-483":true,"vn-484":true,"vn-487":true,"vn-485":true});
    for (const id of ["vn-485"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-101 RequirementsPanel", () => {
const Subject = Subject73;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-481":true,"vn-482":true,"vn-483":true,"vn-484":true,"vn-487":true,"vn-485":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-101 RequirementsPanel", () => {
const Subject = Subject73;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-481":true,"vn-482":true,"vn-483":true,"vn-484":true,"vn-487":true,"vn-485":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-101 RequirementsPanel", () => {
const Subject = Subject73;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-481":true,"vn-482":true,"vn-483":true,"vn-484":true,"vn-487":true,"vn-485":true});
    for (const id of ["vn-485"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-101 RequirementsPanel", () => {
const Subject = Subject73;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designScenario: "scenario-486" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-481":true,"vn-482":true,"vn-483":true,"vn-484":true,"vn-487":true,"vn-485":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-101 RequirementsPanel", () => {
const Subject = Subject73;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designScenario: "scenario-487" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-481":true,"vn-482":true,"vn-483":true,"vn-484":true,"vn-487":true,"vn-485":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-101 RequirementsPanel", () => {
const Subject = Subject73;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designScenario: "scenario-488" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-481":true,"vn-482":true,"vn-483":true,"vn-484":true,"vn-487":true,"vn-485":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-101 RequirementsPanel", () => {
const Subject = Subject73;
it("[vi-488] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture","busy":false}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-485\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-488"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-481":true,"vn-482":true,"vn-483":true,"vn-484":true,"vn-487":true,"vn-485":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-102 DiagramInspector", () => {
const Subject = Subject74;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-489":true,"vn-490":true,"vn-491":true,"vn-492":true,"vn-494":true,"vn-493":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-102 DiagramInspector", () => {
const Subject = Subject74;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-489":true,"vn-490":true,"vn-491":true,"vn-492":true,"vn-494":true,"vn-493":true});
    for (const id of ["vn-493"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-102 DiagramInspector", () => {
const Subject = Subject74;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-489":true,"vn-490":true,"vn-491":true,"vn-492":true,"vn-494":true,"vn-493":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-102 DiagramInspector", () => {
const Subject = Subject74;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-489":true,"vn-490":true,"vn-491":true,"vn-492":true,"vn-494":true,"vn-493":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-102 DiagramInspector", () => {
const Subject = Subject74;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-489":true,"vn-490":true,"vn-491":true,"vn-492":true,"vn-494":true,"vn-493":true});
    for (const id of ["vn-493"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-102 DiagramInspector", () => {
const Subject = Subject74;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designScenario: "scenario-496" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-489":true,"vn-490":true,"vn-491":true,"vn-492":true,"vn-494":true,"vn-493":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-102 DiagramInspector", () => {
const Subject = Subject74;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designScenario: "scenario-497" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-489":true,"vn-490":true,"vn-491":true,"vn-492":true,"vn-494":true,"vn-493":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-102 DiagramInspector", () => {
const Subject = Subject74;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designScenario: "scenario-498" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-489":true,"vn-490":true,"vn-491":true,"vn-492":true,"vn-494":true,"vn-493":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-102 DiagramInspector", () => {
const Subject = Subject74;
it("[vi-495] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture","busy":false}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-493\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-495"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-489":true,"vn-490":true,"vn-491":true,"vn-492":true,"vn-494":true,"vn-493":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-103 SourceOperationEditor", () => {
const Subject = Subject75;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-496":true,"vn-497":true,"vn-498":true,"vn-499":true,"vn-501":true,"vn-500":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-103 SourceOperationEditor", () => {
const Subject = Subject75;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-496":true,"vn-497":true,"vn-498":true,"vn-499":true,"vn-501":true,"vn-500":true});
    for (const id of ["vn-498","vn-500"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-103 SourceOperationEditor", () => {
const Subject = Subject75;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-496":true,"vn-497":true,"vn-498":true,"vn-499":true,"vn-501":true,"vn-500":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-103 SourceOperationEditor", () => {
const Subject = Subject75;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-496":true,"vn-497":true,"vn-498":true,"vn-499":true,"vn-501":true,"vn-500":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-103 SourceOperationEditor", () => {
const Subject = Subject75;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-496":true,"vn-497":true,"vn-498":true,"vn-499":true,"vn-501":true,"vn-500":true});
    for (const id of ["vn-498","vn-500"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-103 SourceOperationEditor", () => {
const Subject = Subject75;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designScenario: "scenario-506" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-496":true,"vn-497":true,"vn-498":true,"vn-499":true,"vn-501":true,"vn-500":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-103 SourceOperationEditor", () => {
const Subject = Subject75;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designScenario: "scenario-507" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-496":true,"vn-497":true,"vn-498":true,"vn-499":true,"vn-501":true,"vn-500":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-103 SourceOperationEditor", () => {
const Subject = Subject75;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designScenario: "scenario-508" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-496":true,"vn-497":true,"vn-498":true,"vn-499":true,"vn-501":true,"vn-500":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-103 SourceOperationEditor", () => {
const Subject = Subject75;
it("[vi-502] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture","busy":false}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-500\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-502"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-496":true,"vn-497":true,"vn-498":true,"vn-499":true,"vn-501":true,"vn-500":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-104 TestOperationPanel", () => {
const Subject = Subject76;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-503":true,"vn-504":true,"vn-505":true,"vn-506":true,"vn-508":true,"vn-507":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-104 TestOperationPanel", () => {
const Subject = Subject76;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-503":true,"vn-504":true,"vn-505":true,"vn-506":true,"vn-508":true,"vn-507":true});
    for (const id of ["vn-507"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-104 TestOperationPanel", () => {
const Subject = Subject76;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-503":true,"vn-504":true,"vn-505":true,"vn-506":true,"vn-508":true,"vn-507":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-104 TestOperationPanel", () => {
const Subject = Subject76;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-503":true,"vn-504":true,"vn-505":true,"vn-506":true,"vn-508":true,"vn-507":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-104 TestOperationPanel", () => {
const Subject = Subject76;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-503":true,"vn-504":true,"vn-505":true,"vn-506":true,"vn-508":true,"vn-507":true});
    for (const id of ["vn-507"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-104 TestOperationPanel", () => {
const Subject = Subject76;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designScenario: "scenario-516" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-503":true,"vn-504":true,"vn-505":true,"vn-506":true,"vn-508":true,"vn-507":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-104 TestOperationPanel", () => {
const Subject = Subject76;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designScenario: "scenario-517" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-503":true,"vn-504":true,"vn-505":true,"vn-506":true,"vn-508":true,"vn-507":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-104 TestOperationPanel", () => {
const Subject = Subject76;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designScenario: "scenario-518" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-503":true,"vn-504":true,"vn-505":true,"vn-506":true,"vn-508":true,"vn-507":true}); } finally { wrapper.unmount(); }
});
});
