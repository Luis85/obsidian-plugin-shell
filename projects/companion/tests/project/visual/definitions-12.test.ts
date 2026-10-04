// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import Subject43 from "../../../src/generated/presentation/components/library/content-media.vue";
import Subject44 from "../../../src/generated/presentation/components/library/content-actions.vue";
import Subject45 from "../../../src/generated/presentation/components/library/content-empty.vue";
import Subject46 from "../../../src/generated/presentation/components/library/content-notice.vue";
import Subject47 from "../../../src/generated/presentation/components/library/pattern-site-header.vue";
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
describe("vc-71 MediaBlock", () => {
const Subject = Subject43;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-253":true,"vn-254":true,"vn-255":true,"vn-256":true,"vn-258":true,"vn-257":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-71 MediaBlock", () => {
const Subject = Subject43;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-253":true,"vn-254":true,"vn-255":true,"vn-256":true,"vn-258":true,"vn-257":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-71 MediaBlock", () => {
const Subject = Subject43;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-253":true,"vn-254":true,"vn-255":true,"vn-256":true,"vn-258":true,"vn-257":true});
    for (const id of ["vn-257"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-71 MediaBlock", () => {
const Subject = Subject43;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-186" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-253":true,"vn-254":true,"vn-255":true,"vn-256":true,"vn-258":true,"vn-257":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-71 MediaBlock", () => {
const Subject = Subject43;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-187" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-253":true,"vn-254":true,"vn-255":true,"vn-256":true,"vn-258":true,"vn-257":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-71 MediaBlock", () => {
const Subject = Subject43;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-188" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-253":true,"vn-254":true,"vn-255":true,"vn-256":true,"vn-258":true,"vn-257":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-71 MediaBlock", () => {
const Subject = Subject43;
it("[vi-259] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-257\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-259"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-253":true,"vn-254":true,"vn-255":true,"vn-256":true,"vn-258":true,"vn-257":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-72 ActionsBlock", () => {
const Subject = Subject44;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-260":true,"vn-261":true,"vn-262":true,"vn-263":true,"vn-265":true,"vn-264":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-72 ActionsBlock", () => {
const Subject = Subject44;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-260":true,"vn-261":true,"vn-262":true,"vn-263":true,"vn-265":true,"vn-264":true});
    for (const id of ["vn-264"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-72 ActionsBlock", () => {
const Subject = Subject44;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-260":true,"vn-261":true,"vn-262":true,"vn-263":true,"vn-265":true,"vn-264":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-72 ActionsBlock", () => {
const Subject = Subject44;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-260":true,"vn-261":true,"vn-262":true,"vn-263":true,"vn-265":true,"vn-264":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-72 ActionsBlock", () => {
const Subject = Subject44;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-260":true,"vn-261":true,"vn-262":true,"vn-263":true,"vn-265":true,"vn-264":true});
    for (const id of ["vn-264"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-72 ActionsBlock", () => {
const Subject = Subject44;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-196" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-260":true,"vn-261":true,"vn-262":true,"vn-263":true,"vn-265":true,"vn-264":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-72 ActionsBlock", () => {
const Subject = Subject44;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-197" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-260":true,"vn-261":true,"vn-262":true,"vn-263":true,"vn-265":true,"vn-264":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-72 ActionsBlock", () => {
const Subject = Subject44;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-198" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-260":true,"vn-261":true,"vn-262":true,"vn-263":true,"vn-265":true,"vn-264":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-72 ActionsBlock", () => {
const Subject = Subject44;
it("[vi-266] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-264\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-266"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-260":true,"vn-261":true,"vn-262":true,"vn-263":true,"vn-265":true,"vn-264":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-73 EmptyBlock", () => {
const Subject = Subject45;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-267":true,"vn-268":true,"vn-269":true,"vn-270":true,"vn-272":true,"vn-271":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-73 EmptyBlock", () => {
const Subject = Subject45;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-267":true,"vn-268":true,"vn-269":true,"vn-270":true,"vn-272":true,"vn-271":true});
    for (const id of ["vn-271"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-73 EmptyBlock", () => {
const Subject = Subject45;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-267":true,"vn-268":true,"vn-269":true,"vn-270":true,"vn-272":true,"vn-271":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-73 EmptyBlock", () => {
const Subject = Subject45;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-267":true,"vn-268":true,"vn-269":true,"vn-270":true,"vn-272":true,"vn-271":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-73 EmptyBlock", () => {
const Subject = Subject45;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-267":true,"vn-268":true,"vn-269":true,"vn-270":true,"vn-272":true,"vn-271":true});
    for (const id of ["vn-271"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-73 EmptyBlock", () => {
const Subject = Subject45;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-206" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-267":true,"vn-268":true,"vn-269":true,"vn-270":true,"vn-272":true,"vn-271":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-73 EmptyBlock", () => {
const Subject = Subject45;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-207" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-267":true,"vn-268":true,"vn-269":true,"vn-270":true,"vn-272":true,"vn-271":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-73 EmptyBlock", () => {
const Subject = Subject45;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-208" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-267":true,"vn-268":true,"vn-269":true,"vn-270":true,"vn-272":true,"vn-271":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-73 EmptyBlock", () => {
const Subject = Subject45;
it("[vi-273] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-271\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-273"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-267":true,"vn-268":true,"vn-269":true,"vn-270":true,"vn-272":true,"vn-271":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-74 NoticeBlock", () => {
const Subject = Subject46;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-274":true,"vn-275":true,"vn-276":true,"vn-277":true,"vn-279":true,"vn-278":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-74 NoticeBlock", () => {
const Subject = Subject46;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-274":true,"vn-275":true,"vn-276":true,"vn-277":true,"vn-279":true,"vn-278":true});
    for (const id of ["vn-278"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-74 NoticeBlock", () => {
const Subject = Subject46;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-274":true,"vn-275":true,"vn-276":true,"vn-277":true,"vn-279":true,"vn-278":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-74 NoticeBlock", () => {
const Subject = Subject46;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-274":true,"vn-275":true,"vn-276":true,"vn-277":true,"vn-279":true,"vn-278":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-74 NoticeBlock", () => {
const Subject = Subject46;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-274":true,"vn-275":true,"vn-276":true,"vn-277":true,"vn-279":true,"vn-278":true});
    for (const id of ["vn-278"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-74 NoticeBlock", () => {
const Subject = Subject46;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-216" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-274":true,"vn-275":true,"vn-276":true,"vn-277":true,"vn-279":true,"vn-278":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-74 NoticeBlock", () => {
const Subject = Subject46;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-217" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-274":true,"vn-275":true,"vn-276":true,"vn-277":true,"vn-279":true,"vn-278":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-74 NoticeBlock", () => {
const Subject = Subject46;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-218" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-274":true,"vn-275":true,"vn-276":true,"vn-277":true,"vn-279":true,"vn-278":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-74 NoticeBlock", () => {
const Subject = Subject46;
it("[vi-280] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-278\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-280"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-274":true,"vn-275":true,"vn-276":true,"vn-277":true,"vn-279":true,"vn-278":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-75 SiteHeader", () => {
const Subject = Subject47;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-281":true,"vn-282":true,"vn-283":true,"vn-284":true,"vn-286":true,"vn-285":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-75 SiteHeader", () => {
const Subject = Subject47;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-281":true,"vn-282":true,"vn-283":true,"vn-284":true,"vn-286":true,"vn-285":true});
    for (const id of ["vn-285"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-75 SiteHeader", () => {
const Subject = Subject47;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-281":true,"vn-282":true,"vn-283":true,"vn-284":true,"vn-286":true,"vn-285":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-75 SiteHeader", () => {
const Subject = Subject47;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-281":true,"vn-282":true,"vn-283":true,"vn-284":true,"vn-286":true,"vn-285":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-75 SiteHeader", () => {
const Subject = Subject47;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-281":true,"vn-282":true,"vn-283":true,"vn-284":true,"vn-286":true,"vn-285":true});
    for (const id of ["vn-285"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-75 SiteHeader", () => {
const Subject = Subject47;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-226" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-281":true,"vn-282":true,"vn-283":true,"vn-284":true,"vn-286":true,"vn-285":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-75 SiteHeader", () => {
const Subject = Subject47;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-227" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-281":true,"vn-282":true,"vn-283":true,"vn-284":true,"vn-286":true,"vn-285":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-75 SiteHeader", () => {
const Subject = Subject47;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-228" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-281":true,"vn-282":true,"vn-283":true,"vn-284":true,"vn-286":true,"vn-285":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-75 SiteHeader", () => {
const Subject = Subject47;
it("[vi-287] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-285\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-287"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-281":true,"vn-282":true,"vn-283":true,"vn-284":true,"vn-286":true,"vn-285":true});
  } finally { wrapper.unmount(); }
});
});
