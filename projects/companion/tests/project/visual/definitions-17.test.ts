// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import Subject67 from "../../../src/generated/presentation/components/library/pattern-conversation.vue";
import Subject68 from "../../../src/generated/presentation/components/library/pattern-progress.vue";
import Subject69 from "../../../src/generated/presentation/components/library/pattern-command-search.vue";
import Subject70 from "../../../src/generated/presentation/components/library/pattern-permissions.vue";
import Subject71 from "../../../src/generated/presentation/components/library/workflow-rail.vue";
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
describe("vc-95 Conversation", () => {
const Subject = Subject67;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-429":true,"vn-430":true,"vn-431":true,"vn-434":true,"vn-435":true,"vn-436":true,"vn-437":true,"vn-432":true,"vn-438":true,"vn-433":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-95 Conversation", () => {
const Subject = Subject67;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-429":true,"vn-430":true,"vn-431":true,"vn-434":true,"vn-435":true,"vn-436":true,"vn-437":true,"vn-432":true,"vn-438":true,"vn-433":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-95 Conversation", () => {
const Subject = Subject67;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-429":true,"vn-430":true,"vn-431":true,"vn-434":true,"vn-435":true,"vn-436":true,"vn-437":true,"vn-432":true,"vn-438":true,"vn-433":true});
    for (const id of ["vn-433"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-95 Conversation", () => {
const Subject = Subject67;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-426" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-429":true,"vn-430":true,"vn-431":true,"vn-434":true,"vn-435":true,"vn-436":true,"vn-437":true,"vn-432":true,"vn-438":true,"vn-433":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-95 Conversation", () => {
const Subject = Subject67;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-427" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-429":true,"vn-430":true,"vn-431":true,"vn-434":true,"vn-435":true,"vn-436":true,"vn-437":true,"vn-432":true,"vn-438":true,"vn-433":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-95 Conversation", () => {
const Subject = Subject67;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-428" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-429":true,"vn-430":true,"vn-431":true,"vn-434":true,"vn-435":true,"vn-436":true,"vn-437":true,"vn-432":true,"vn-438":true,"vn-433":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-95 Conversation", () => {
const Subject = Subject67;
it("[vi-439] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-433\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-439"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-429":true,"vn-430":true,"vn-431":true,"vn-434":true,"vn-435":true,"vn-436":true,"vn-437":true,"vn-432":true,"vn-438":true,"vn-433":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-96 ProgressTracker", () => {
const Subject = Subject68;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-440":true,"vn-441":true,"vn-442":true,"vn-443":true,"vn-445":true,"vn-444":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-96 ProgressTracker", () => {
const Subject = Subject68;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-440":true,"vn-441":true,"vn-442":true,"vn-443":true,"vn-445":true,"vn-444":true});
    for (const id of ["vn-444"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-96 ProgressTracker", () => {
const Subject = Subject68;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-440":true,"vn-441":true,"vn-442":true,"vn-443":true,"vn-445":true,"vn-444":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-96 ProgressTracker", () => {
const Subject = Subject68;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-440":true,"vn-441":true,"vn-442":true,"vn-443":true,"vn-445":true,"vn-444":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-96 ProgressTracker", () => {
const Subject = Subject68;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-440":true,"vn-441":true,"vn-442":true,"vn-443":true,"vn-445":true,"vn-444":true});
    for (const id of ["vn-444"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-96 ProgressTracker", () => {
const Subject = Subject68;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-436" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-440":true,"vn-441":true,"vn-442":true,"vn-443":true,"vn-445":true,"vn-444":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-96 ProgressTracker", () => {
const Subject = Subject68;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-437" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-440":true,"vn-441":true,"vn-442":true,"vn-443":true,"vn-445":true,"vn-444":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-96 ProgressTracker", () => {
const Subject = Subject68;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-438" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-440":true,"vn-441":true,"vn-442":true,"vn-443":true,"vn-445":true,"vn-444":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-96 ProgressTracker", () => {
const Subject = Subject68;
it("[vi-446] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-444\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-446"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-440":true,"vn-441":true,"vn-442":true,"vn-443":true,"vn-445":true,"vn-444":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-97 CommandSearch", () => {
const Subject = Subject69;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-447":true,"vn-448":true,"vn-449":true,"vn-450":true,"vn-452":true,"vn-451":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-97 CommandSearch", () => {
const Subject = Subject69;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-447":true,"vn-448":true,"vn-449":true,"vn-450":true,"vn-452":true,"vn-451":true});
    for (const id of ["vn-449","vn-451"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-97 CommandSearch", () => {
const Subject = Subject69;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-447":true,"vn-448":true,"vn-449":true,"vn-450":true,"vn-452":true,"vn-451":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-97 CommandSearch", () => {
const Subject = Subject69;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-447":true,"vn-448":true,"vn-449":true,"vn-450":true,"vn-452":true,"vn-451":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-97 CommandSearch", () => {
const Subject = Subject69;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-447":true,"vn-448":true,"vn-449":true,"vn-450":true,"vn-452":true,"vn-451":true});
    for (const id of ["vn-449","vn-451"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-97 CommandSearch", () => {
const Subject = Subject69;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-446" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-447":true,"vn-448":true,"vn-449":true,"vn-450":true,"vn-452":true,"vn-451":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-97 CommandSearch", () => {
const Subject = Subject69;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-447" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-447":true,"vn-448":true,"vn-449":true,"vn-450":true,"vn-452":true,"vn-451":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-97 CommandSearch", () => {
const Subject = Subject69;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-448" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-447":true,"vn-448":true,"vn-449":true,"vn-450":true,"vn-452":true,"vn-451":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-97 CommandSearch", () => {
const Subject = Subject69;
it("[vi-453] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-451\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-453"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-447":true,"vn-448":true,"vn-449":true,"vn-450":true,"vn-452":true,"vn-451":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-98 PermissionsTable", () => {
const Subject = Subject70;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-454":true,"vn-455":true,"vn-456":true,"vn-457":true,"vn-460":true,"vn-458":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-98 PermissionsTable", () => {
const Subject = Subject70;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-454":true,"vn-455":true,"vn-456":true,"vn-457":true,"vn-460":true,"vn-458":true});
    for (const id of ["vn-458"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-98 PermissionsTable", () => {
const Subject = Subject70;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-454":true,"vn-455":true,"vn-456":true,"vn-457":true,"vn-460":true,"vn-458":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-98 PermissionsTable", () => {
const Subject = Subject70;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-454":true,"vn-455":true,"vn-456":true,"vn-457":true,"vn-460":true,"vn-458":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-98 PermissionsTable", () => {
const Subject = Subject70;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-454":true,"vn-455":true,"vn-456":true,"vn-457":true,"vn-460":true,"vn-458":true});
    for (const id of ["vn-458"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-98 PermissionsTable", () => {
const Subject = Subject70;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-456" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-454":true,"vn-455":true,"vn-456":true,"vn-457":true,"vn-460":true,"vn-458":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-98 PermissionsTable", () => {
const Subject = Subject70;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-457" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-454":true,"vn-455":true,"vn-456":true,"vn-457":true,"vn-460":true,"vn-458":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-98 PermissionsTable", () => {
const Subject = Subject70;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-458" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-454":true,"vn-455":true,"vn-456":true,"vn-457":true,"vn-460":true,"vn-458":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-98 PermissionsTable", () => {
const Subject = Subject70;
it("[vi-461] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-458\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-461"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-454":true,"vn-455":true,"vn-456":true,"vn-457":true,"vn-460":true,"vn-458":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-99 WorkflowRail", () => {
const Subject = Subject71;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-462":true,"vn-463":true,"vn-464":true,"vn-467":true,"vn-468":true,"vn-469":true,"vn-470":true,"vn-465":true,"vn-471":true,"vn-466":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-99 WorkflowRail", () => {
const Subject = Subject71;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-462":true,"vn-463":true,"vn-464":true,"vn-467":true,"vn-468":true,"vn-469":true,"vn-470":true,"vn-465":true,"vn-471":true,"vn-466":true});
    for (const id of ["vn-466"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-99 WorkflowRail", () => {
const Subject = Subject71;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-462":true,"vn-463":true,"vn-464":true,"vn-467":true,"vn-468":true,"vn-469":true,"vn-470":true,"vn-465":true,"vn-471":true,"vn-466":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-99 WorkflowRail", () => {
const Subject = Subject71;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-462":true,"vn-463":true,"vn-464":true,"vn-467":true,"vn-468":true,"vn-469":true,"vn-470":true,"vn-465":true,"vn-471":true,"vn-466":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-99 WorkflowRail", () => {
const Subject = Subject71;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-462":true,"vn-463":true,"vn-464":true,"vn-467":true,"vn-468":true,"vn-469":true,"vn-470":true,"vn-465":true,"vn-471":true,"vn-466":true});
    for (const id of ["vn-466"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-99 WorkflowRail", () => {
const Subject = Subject71;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designScenario: "scenario-466" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-462":true,"vn-463":true,"vn-464":true,"vn-467":true,"vn-468":true,"vn-469":true,"vn-470":true,"vn-465":true,"vn-471":true,"vn-466":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-99 WorkflowRail", () => {
const Subject = Subject71;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designScenario: "scenario-467" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-462":true,"vn-463":true,"vn-464":true,"vn-467":true,"vn-468":true,"vn-469":true,"vn-470":true,"vn-465":true,"vn-471":true,"vn-466":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-99 WorkflowRail", () => {
const Subject = Subject71;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designScenario: "scenario-468" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-462":true,"vn-463":true,"vn-464":true,"vn-467":true,"vn-468":true,"vn-469":true,"vn-470":true,"vn-465":true,"vn-471":true,"vn-466":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-99 WorkflowRail", () => {
const Subject = Subject71;
it("[vi-472] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture","busy":false}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-466\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-472"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-462":true,"vn-463":true,"vn-464":true,"vn-467":true,"vn-468":true,"vn-469":true,"vn-470":true,"vn-465":true,"vn-471":true,"vn-466":true});
  } finally { wrapper.unmount(); }
});
});
