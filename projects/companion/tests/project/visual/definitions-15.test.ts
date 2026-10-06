// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import Subject57 from "../../../src/generated/presentation/components/library/pattern-article.vue";
import Subject58 from "../../../src/generated/presentation/components/library/pattern-breadcrumbs.vue";
import Subject59 from "../../../src/generated/presentation/components/library/pattern-app-sidebar.vue";
import Subject60 from "../../../src/generated/presentation/components/library/pattern-tab-strip.vue";
import Subject61 from "../../../src/generated/presentation/components/library/pattern-metric-summary.vue";
import Subject62 from "../../../src/generated/presentation/components/library/pattern-activity-timeline.vue";
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
describe("vc-85 ArticleBody", () => {
const Subject = Subject57;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-327" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-351":true,"vn-352":true,"vn-353":true,"vn-354":true,"vn-356":true,"vn-355":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-85 ArticleBody", () => {
const Subject = Subject57;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-328" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-351":true,"vn-352":true,"vn-353":true,"vn-354":true,"vn-356":true,"vn-355":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-85 ArticleBody", () => {
const Subject = Subject57;
it("[vi-357] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-355\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-357"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-351":true,"vn-352":true,"vn-353":true,"vn-354":true,"vn-356":true,"vn-355":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-86 BreadcrumbTrail", () => {
const Subject = Subject58;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-358":true,"vn-359":true,"vn-360":true,"vn-361":true,"vn-363":true,"vn-362":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-86 BreadcrumbTrail", () => {
const Subject = Subject58;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-358":true,"vn-359":true,"vn-360":true,"vn-361":true,"vn-363":true,"vn-362":true});
    for (const id of ["vn-362"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-86 BreadcrumbTrail", () => {
const Subject = Subject58;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-358":true,"vn-359":true,"vn-360":true,"vn-361":true,"vn-363":true,"vn-362":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-86 BreadcrumbTrail", () => {
const Subject = Subject58;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-358":true,"vn-359":true,"vn-360":true,"vn-361":true,"vn-363":true,"vn-362":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-86 BreadcrumbTrail", () => {
const Subject = Subject58;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-358":true,"vn-359":true,"vn-360":true,"vn-361":true,"vn-363":true,"vn-362":true});
    for (const id of ["vn-362"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-86 BreadcrumbTrail", () => {
const Subject = Subject58;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-336" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-358":true,"vn-359":true,"vn-360":true,"vn-361":true,"vn-363":true,"vn-362":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-86 BreadcrumbTrail", () => {
const Subject = Subject58;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-337" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-358":true,"vn-359":true,"vn-360":true,"vn-361":true,"vn-363":true,"vn-362":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-86 BreadcrumbTrail", () => {
const Subject = Subject58;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-338" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-358":true,"vn-359":true,"vn-360":true,"vn-361":true,"vn-363":true,"vn-362":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-86 BreadcrumbTrail", () => {
const Subject = Subject58;
it("[vi-364] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-362\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-364"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-358":true,"vn-359":true,"vn-360":true,"vn-361":true,"vn-363":true,"vn-362":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-87 AppSidebar", () => {
const Subject = Subject59;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-365":true,"vn-366":true,"vn-367":true,"vn-370":true,"vn-371":true,"vn-372":true,"vn-373":true,"vn-368":true,"vn-374":true,"vn-369":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-87 AppSidebar", () => {
const Subject = Subject59;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-365":true,"vn-366":true,"vn-367":true,"vn-370":true,"vn-371":true,"vn-372":true,"vn-373":true,"vn-368":true,"vn-374":true,"vn-369":true});
    for (const id of ["vn-369"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-87 AppSidebar", () => {
const Subject = Subject59;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-365":true,"vn-366":true,"vn-367":true,"vn-370":true,"vn-371":true,"vn-372":true,"vn-373":true,"vn-368":true,"vn-374":true,"vn-369":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-87 AppSidebar", () => {
const Subject = Subject59;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-365":true,"vn-366":true,"vn-367":true,"vn-370":true,"vn-371":true,"vn-372":true,"vn-373":true,"vn-368":true,"vn-374":true,"vn-369":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-87 AppSidebar", () => {
const Subject = Subject59;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-365":true,"vn-366":true,"vn-367":true,"vn-370":true,"vn-371":true,"vn-372":true,"vn-373":true,"vn-368":true,"vn-374":true,"vn-369":true});
    for (const id of ["vn-369"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-87 AppSidebar", () => {
const Subject = Subject59;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-346" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-365":true,"vn-366":true,"vn-367":true,"vn-370":true,"vn-371":true,"vn-372":true,"vn-373":true,"vn-368":true,"vn-374":true,"vn-369":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-87 AppSidebar", () => {
const Subject = Subject59;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-347" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-365":true,"vn-366":true,"vn-367":true,"vn-370":true,"vn-371":true,"vn-372":true,"vn-373":true,"vn-368":true,"vn-374":true,"vn-369":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-87 AppSidebar", () => {
const Subject = Subject59;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-348" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-365":true,"vn-366":true,"vn-367":true,"vn-370":true,"vn-371":true,"vn-372":true,"vn-373":true,"vn-368":true,"vn-374":true,"vn-369":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-87 AppSidebar", () => {
const Subject = Subject59;
it("[vi-375] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-369\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-375"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-365":true,"vn-366":true,"vn-367":true,"vn-370":true,"vn-371":true,"vn-372":true,"vn-373":true,"vn-368":true,"vn-374":true,"vn-369":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-88 TabStrip", () => {
const Subject = Subject60;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-376":true,"vn-377":true,"vn-378":true,"vn-379":true,"vn-381":true,"vn-380":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-88 TabStrip", () => {
const Subject = Subject60;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-376":true,"vn-377":true,"vn-378":true,"vn-379":true,"vn-381":true,"vn-380":true});
    for (const id of ["vn-380"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-88 TabStrip", () => {
const Subject = Subject60;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-376":true,"vn-377":true,"vn-378":true,"vn-379":true,"vn-381":true,"vn-380":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-88 TabStrip", () => {
const Subject = Subject60;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-376":true,"vn-377":true,"vn-378":true,"vn-379":true,"vn-381":true,"vn-380":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-88 TabStrip", () => {
const Subject = Subject60;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-376":true,"vn-377":true,"vn-378":true,"vn-379":true,"vn-381":true,"vn-380":true});
    for (const id of ["vn-380"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-88 TabStrip", () => {
const Subject = Subject60;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-356" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-376":true,"vn-377":true,"vn-378":true,"vn-379":true,"vn-381":true,"vn-380":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-88 TabStrip", () => {
const Subject = Subject60;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-357" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-376":true,"vn-377":true,"vn-378":true,"vn-379":true,"vn-381":true,"vn-380":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-88 TabStrip", () => {
const Subject = Subject60;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-358" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-376":true,"vn-377":true,"vn-378":true,"vn-379":true,"vn-381":true,"vn-380":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-88 TabStrip", () => {
const Subject = Subject60;
it("[vi-382] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-380\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-382"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-376":true,"vn-377":true,"vn-378":true,"vn-379":true,"vn-381":true,"vn-380":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-89 MetricSummary", () => {
const Subject = Subject61;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-383":true,"vn-384":true,"vn-385":true,"vn-386":true,"vn-388":true,"vn-387":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-89 MetricSummary", () => {
const Subject = Subject61;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-383":true,"vn-384":true,"vn-385":true,"vn-386":true,"vn-388":true,"vn-387":true});
    for (const id of ["vn-387"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-89 MetricSummary", () => {
const Subject = Subject61;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-383":true,"vn-384":true,"vn-385":true,"vn-386":true,"vn-388":true,"vn-387":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-89 MetricSummary", () => {
const Subject = Subject61;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-383":true,"vn-384":true,"vn-385":true,"vn-386":true,"vn-388":true,"vn-387":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-89 MetricSummary", () => {
const Subject = Subject61;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-383":true,"vn-384":true,"vn-385":true,"vn-386":true,"vn-388":true,"vn-387":true});
    for (const id of ["vn-387"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-89 MetricSummary", () => {
const Subject = Subject61;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-366" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-383":true,"vn-384":true,"vn-385":true,"vn-386":true,"vn-388":true,"vn-387":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-89 MetricSummary", () => {
const Subject = Subject61;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-367" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-383":true,"vn-384":true,"vn-385":true,"vn-386":true,"vn-388":true,"vn-387":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-89 MetricSummary", () => {
const Subject = Subject61;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-368" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-383":true,"vn-384":true,"vn-385":true,"vn-386":true,"vn-388":true,"vn-387":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-89 MetricSummary", () => {
const Subject = Subject61;
it("[vi-389] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-387\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-389"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-383":true,"vn-384":true,"vn-385":true,"vn-386":true,"vn-388":true,"vn-387":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-90 ActivityTimeline", () => {
const Subject = Subject62;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-390":true,"vn-391":true,"vn-392":true,"vn-395":true,"vn-396":true,"vn-397":true,"vn-398":true,"vn-393":true,"vn-399":true,"vn-394":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-90 ActivityTimeline", () => {
const Subject = Subject62;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-390":true,"vn-391":true,"vn-392":true,"vn-395":true,"vn-396":true,"vn-397":true,"vn-398":true,"vn-393":true,"vn-399":true,"vn-394":true});
    for (const id of ["vn-394"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-90 ActivityTimeline", () => {
const Subject = Subject62;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-390":true,"vn-391":true,"vn-392":true,"vn-395":true,"vn-396":true,"vn-397":true,"vn-398":true,"vn-393":true,"vn-399":true,"vn-394":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-90 ActivityTimeline", () => {
const Subject = Subject62;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-390":true,"vn-391":true,"vn-392":true,"vn-395":true,"vn-396":true,"vn-397":true,"vn-398":true,"vn-393":true,"vn-399":true,"vn-394":true});
  } finally { wrapper.unmount(); }
});
});
