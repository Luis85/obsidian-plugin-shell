// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import Subject62 from "../../../src/generated/presentation/components/library/pattern-activity-timeline.vue";
import Subject63 from "../../../src/generated/presentation/components/library/pattern-calendar.vue";
import Subject64 from "../../../src/generated/presentation/components/library/pattern-file-upload.vue";
import Subject65 from "../../../src/generated/presentation/components/library/pattern-profile.vue";
import Subject66 from "../../../src/generated/presentation/components/library/pattern-code-editor.vue";
import Subject67 from "../../../src/generated/presentation/components/library/pattern-conversation.vue";
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
describe("vc-90 ActivityTimeline", () => {
const Subject = Subject62;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-390":true,"vn-391":true,"vn-392":true,"vn-395":true,"vn-396":true,"vn-397":true,"vn-398":true,"vn-393":true,"vn-399":true,"vn-394":true});
    for (const id of ["vn-394"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-90 ActivityTimeline", () => {
const Subject = Subject62;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-376" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-390":true,"vn-391":true,"vn-392":true,"vn-395":true,"vn-396":true,"vn-397":true,"vn-398":true,"vn-393":true,"vn-399":true,"vn-394":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-90 ActivityTimeline", () => {
const Subject = Subject62;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-377" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-390":true,"vn-391":true,"vn-392":true,"vn-395":true,"vn-396":true,"vn-397":true,"vn-398":true,"vn-393":true,"vn-399":true,"vn-394":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-90 ActivityTimeline", () => {
const Subject = Subject62;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-378" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-390":true,"vn-391":true,"vn-392":true,"vn-395":true,"vn-396":true,"vn-397":true,"vn-398":true,"vn-393":true,"vn-399":true,"vn-394":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-90 ActivityTimeline", () => {
const Subject = Subject62;
it("[vi-400] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-394\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-400"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-390":true,"vn-391":true,"vn-392":true,"vn-395":true,"vn-396":true,"vn-397":true,"vn-398":true,"vn-393":true,"vn-399":true,"vn-394":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-91 CalendarView", () => {
const Subject = Subject63;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-401":true,"vn-402":true,"vn-403":true,"vn-404":true,"vn-406":true,"vn-405":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-91 CalendarView", () => {
const Subject = Subject63;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-401":true,"vn-402":true,"vn-403":true,"vn-404":true,"vn-406":true,"vn-405":true});
    for (const id of ["vn-405"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-91 CalendarView", () => {
const Subject = Subject63;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-401":true,"vn-402":true,"vn-403":true,"vn-404":true,"vn-406":true,"vn-405":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-91 CalendarView", () => {
const Subject = Subject63;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-401":true,"vn-402":true,"vn-403":true,"vn-404":true,"vn-406":true,"vn-405":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-91 CalendarView", () => {
const Subject = Subject63;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-401":true,"vn-402":true,"vn-403":true,"vn-404":true,"vn-406":true,"vn-405":true});
    for (const id of ["vn-405"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-91 CalendarView", () => {
const Subject = Subject63;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-386" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-401":true,"vn-402":true,"vn-403":true,"vn-404":true,"vn-406":true,"vn-405":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-91 CalendarView", () => {
const Subject = Subject63;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-387" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-401":true,"vn-402":true,"vn-403":true,"vn-404":true,"vn-406":true,"vn-405":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-91 CalendarView", () => {
const Subject = Subject63;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-388" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-401":true,"vn-402":true,"vn-403":true,"vn-404":true,"vn-406":true,"vn-405":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-91 CalendarView", () => {
const Subject = Subject63;
it("[vi-407] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-405\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-407"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-401":true,"vn-402":true,"vn-403":true,"vn-404":true,"vn-406":true,"vn-405":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-92 FileUpload", () => {
const Subject = Subject64;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-408":true,"vn-409":true,"vn-410":true,"vn-411":true,"vn-413":true,"vn-412":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-92 FileUpload", () => {
const Subject = Subject64;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-408":true,"vn-409":true,"vn-410":true,"vn-411":true,"vn-413":true,"vn-412":true});
    for (const id of ["vn-412"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-92 FileUpload", () => {
const Subject = Subject64;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-408":true,"vn-409":true,"vn-410":true,"vn-411":true,"vn-413":true,"vn-412":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-92 FileUpload", () => {
const Subject = Subject64;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-408":true,"vn-409":true,"vn-410":true,"vn-411":true,"vn-413":true,"vn-412":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-92 FileUpload", () => {
const Subject = Subject64;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-408":true,"vn-409":true,"vn-410":true,"vn-411":true,"vn-413":true,"vn-412":true});
    for (const id of ["vn-412"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-92 FileUpload", () => {
const Subject = Subject64;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-396" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-408":true,"vn-409":true,"vn-410":true,"vn-411":true,"vn-413":true,"vn-412":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-92 FileUpload", () => {
const Subject = Subject64;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-397" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-408":true,"vn-409":true,"vn-410":true,"vn-411":true,"vn-413":true,"vn-412":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-92 FileUpload", () => {
const Subject = Subject64;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-398" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-408":true,"vn-409":true,"vn-410":true,"vn-411":true,"vn-413":true,"vn-412":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-92 FileUpload", () => {
const Subject = Subject64;
it("[vi-414] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-412\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-414"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-408":true,"vn-409":true,"vn-410":true,"vn-411":true,"vn-413":true,"vn-412":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-93 UserProfile", () => {
const Subject = Subject65;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-415":true,"vn-416":true,"vn-417":true,"vn-418":true,"vn-420":true,"vn-419":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-93 UserProfile", () => {
const Subject = Subject65;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-415":true,"vn-416":true,"vn-417":true,"vn-418":true,"vn-420":true,"vn-419":true});
    for (const id of ["vn-419"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-93 UserProfile", () => {
const Subject = Subject65;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-415":true,"vn-416":true,"vn-417":true,"vn-418":true,"vn-420":true,"vn-419":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-93 UserProfile", () => {
const Subject = Subject65;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-415":true,"vn-416":true,"vn-417":true,"vn-418":true,"vn-420":true,"vn-419":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-93 UserProfile", () => {
const Subject = Subject65;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-415":true,"vn-416":true,"vn-417":true,"vn-418":true,"vn-420":true,"vn-419":true});
    for (const id of ["vn-419"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-93 UserProfile", () => {
const Subject = Subject65;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-406" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-415":true,"vn-416":true,"vn-417":true,"vn-418":true,"vn-420":true,"vn-419":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-93 UserProfile", () => {
const Subject = Subject65;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-407" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-415":true,"vn-416":true,"vn-417":true,"vn-418":true,"vn-420":true,"vn-419":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-93 UserProfile", () => {
const Subject = Subject65;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-408" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-415":true,"vn-416":true,"vn-417":true,"vn-418":true,"vn-420":true,"vn-419":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-93 UserProfile", () => {
const Subject = Subject65;
it("[vi-421] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-419\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-421"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-415":true,"vn-416":true,"vn-417":true,"vn-418":true,"vn-420":true,"vn-419":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-94 CodeEditor", () => {
const Subject = Subject66;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-422":true,"vn-423":true,"vn-424":true,"vn-425":true,"vn-427":true,"vn-426":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-94 CodeEditor", () => {
const Subject = Subject66;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-422":true,"vn-423":true,"vn-424":true,"vn-425":true,"vn-427":true,"vn-426":true});
    for (const id of ["vn-424","vn-426"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-94 CodeEditor", () => {
const Subject = Subject66;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-422":true,"vn-423":true,"vn-424":true,"vn-425":true,"vn-427":true,"vn-426":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-94 CodeEditor", () => {
const Subject = Subject66;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-422":true,"vn-423":true,"vn-424":true,"vn-425":true,"vn-427":true,"vn-426":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-94 CodeEditor", () => {
const Subject = Subject66;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-422":true,"vn-423":true,"vn-424":true,"vn-425":true,"vn-427":true,"vn-426":true});
    for (const id of ["vn-424","vn-426"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-94 CodeEditor", () => {
const Subject = Subject66;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-416" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-422":true,"vn-423":true,"vn-424":true,"vn-425":true,"vn-427":true,"vn-426":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-94 CodeEditor", () => {
const Subject = Subject66;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-417" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-422":true,"vn-423":true,"vn-424":true,"vn-425":true,"vn-427":true,"vn-426":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-94 CodeEditor", () => {
const Subject = Subject66;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-418" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-422":true,"vn-423":true,"vn-424":true,"vn-425":true,"vn-427":true,"vn-426":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-94 CodeEditor", () => {
const Subject = Subject66;
it("[vi-428] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-426\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-428"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-422":true,"vn-423":true,"vn-424":true,"vn-425":true,"vn-427":true,"vn-426":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-95 Conversation", () => {
const Subject = Subject67;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-429":true,"vn-430":true,"vn-431":true,"vn-434":true,"vn-435":true,"vn-436":true,"vn-437":true,"vn-432":true,"vn-438":true,"vn-433":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-95 Conversation", () => {
const Subject = Subject67;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-429":true,"vn-430":true,"vn-431":true,"vn-434":true,"vn-435":true,"vn-436":true,"vn-437":true,"vn-432":true,"vn-438":true,"vn-433":true});
    for (const id of ["vn-433"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
