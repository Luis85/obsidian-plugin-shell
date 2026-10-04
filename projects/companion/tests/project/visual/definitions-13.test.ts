// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import Subject48 from "../../../src/generated/presentation/components/library/pattern-hero.vue";
import Subject49 from "../../../src/generated/presentation/components/library/pattern-feature-grid.vue";
import Subject50 from "../../../src/generated/presentation/components/library/pattern-pricing.vue";
import Subject51 from "../../../src/generated/presentation/components/library/pattern-testimonials.vue";
import Subject52 from "../../../src/generated/presentation/components/library/pattern-faq.vue";
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
describe("vc-76 HeroSection", () => {
const Subject = Subject48;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-288":true,"vn-289":true,"vn-290":true,"vn-291":true,"vn-293":true,"vn-292":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-76 HeroSection", () => {
const Subject = Subject48;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-288":true,"vn-289":true,"vn-290":true,"vn-291":true,"vn-293":true,"vn-292":true});
    for (const id of ["vn-292"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-76 HeroSection", () => {
const Subject = Subject48;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-288":true,"vn-289":true,"vn-290":true,"vn-291":true,"vn-293":true,"vn-292":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-76 HeroSection", () => {
const Subject = Subject48;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-288":true,"vn-289":true,"vn-290":true,"vn-291":true,"vn-293":true,"vn-292":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-76 HeroSection", () => {
const Subject = Subject48;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-288":true,"vn-289":true,"vn-290":true,"vn-291":true,"vn-293":true,"vn-292":true});
    for (const id of ["vn-292"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-76 HeroSection", () => {
const Subject = Subject48;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-236" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-288":true,"vn-289":true,"vn-290":true,"vn-291":true,"vn-293":true,"vn-292":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-76 HeroSection", () => {
const Subject = Subject48;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-237" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-288":true,"vn-289":true,"vn-290":true,"vn-291":true,"vn-293":true,"vn-292":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-76 HeroSection", () => {
const Subject = Subject48;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-238" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-288":true,"vn-289":true,"vn-290":true,"vn-291":true,"vn-293":true,"vn-292":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-76 HeroSection", () => {
const Subject = Subject48;
it("[vi-294] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-292\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-294"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-288":true,"vn-289":true,"vn-290":true,"vn-291":true,"vn-293":true,"vn-292":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-77 FeatureGrid", () => {
const Subject = Subject49;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-295":true,"vn-296":true,"vn-297":true,"vn-298":true,"vn-300":true,"vn-299":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-77 FeatureGrid", () => {
const Subject = Subject49;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-295":true,"vn-296":true,"vn-297":true,"vn-298":true,"vn-300":true,"vn-299":true});
    for (const id of ["vn-299"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-77 FeatureGrid", () => {
const Subject = Subject49;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-295":true,"vn-296":true,"vn-297":true,"vn-298":true,"vn-300":true,"vn-299":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-77 FeatureGrid", () => {
const Subject = Subject49;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-295":true,"vn-296":true,"vn-297":true,"vn-298":true,"vn-300":true,"vn-299":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-77 FeatureGrid", () => {
const Subject = Subject49;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-295":true,"vn-296":true,"vn-297":true,"vn-298":true,"vn-300":true,"vn-299":true});
    for (const id of ["vn-299"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-77 FeatureGrid", () => {
const Subject = Subject49;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-246" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-295":true,"vn-296":true,"vn-297":true,"vn-298":true,"vn-300":true,"vn-299":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-77 FeatureGrid", () => {
const Subject = Subject49;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-247" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-295":true,"vn-296":true,"vn-297":true,"vn-298":true,"vn-300":true,"vn-299":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-77 FeatureGrid", () => {
const Subject = Subject49;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-248" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-295":true,"vn-296":true,"vn-297":true,"vn-298":true,"vn-300":true,"vn-299":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-77 FeatureGrid", () => {
const Subject = Subject49;
it("[vi-301] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-299\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-301"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-295":true,"vn-296":true,"vn-297":true,"vn-298":true,"vn-300":true,"vn-299":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-78 PricingPlans", () => {
const Subject = Subject50;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-302":true,"vn-303":true,"vn-304":true,"vn-305":true,"vn-307":true,"vn-306":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-78 PricingPlans", () => {
const Subject = Subject50;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-302":true,"vn-303":true,"vn-304":true,"vn-305":true,"vn-307":true,"vn-306":true});
    for (const id of ["vn-306"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-78 PricingPlans", () => {
const Subject = Subject50;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-302":true,"vn-303":true,"vn-304":true,"vn-305":true,"vn-307":true,"vn-306":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-78 PricingPlans", () => {
const Subject = Subject50;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-302":true,"vn-303":true,"vn-304":true,"vn-305":true,"vn-307":true,"vn-306":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-78 PricingPlans", () => {
const Subject = Subject50;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-302":true,"vn-303":true,"vn-304":true,"vn-305":true,"vn-307":true,"vn-306":true});
    for (const id of ["vn-306"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-78 PricingPlans", () => {
const Subject = Subject50;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-256" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-302":true,"vn-303":true,"vn-304":true,"vn-305":true,"vn-307":true,"vn-306":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-78 PricingPlans", () => {
const Subject = Subject50;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-257" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-302":true,"vn-303":true,"vn-304":true,"vn-305":true,"vn-307":true,"vn-306":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-78 PricingPlans", () => {
const Subject = Subject50;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-258" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-302":true,"vn-303":true,"vn-304":true,"vn-305":true,"vn-307":true,"vn-306":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-78 PricingPlans", () => {
const Subject = Subject50;
it("[vi-308] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-306\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-308"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-302":true,"vn-303":true,"vn-304":true,"vn-305":true,"vn-307":true,"vn-306":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-79 Testimonials", () => {
const Subject = Subject51;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-309":true,"vn-310":true,"vn-311":true,"vn-312":true,"vn-314":true,"vn-313":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-79 Testimonials", () => {
const Subject = Subject51;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-309":true,"vn-310":true,"vn-311":true,"vn-312":true,"vn-314":true,"vn-313":true});
    for (const id of ["vn-313"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-79 Testimonials", () => {
const Subject = Subject51;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-309":true,"vn-310":true,"vn-311":true,"vn-312":true,"vn-314":true,"vn-313":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-79 Testimonials", () => {
const Subject = Subject51;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-309":true,"vn-310":true,"vn-311":true,"vn-312":true,"vn-314":true,"vn-313":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-79 Testimonials", () => {
const Subject = Subject51;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-309":true,"vn-310":true,"vn-311":true,"vn-312":true,"vn-314":true,"vn-313":true});
    for (const id of ["vn-313"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-79 Testimonials", () => {
const Subject = Subject51;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-266" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-309":true,"vn-310":true,"vn-311":true,"vn-312":true,"vn-314":true,"vn-313":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-79 Testimonials", () => {
const Subject = Subject51;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-267" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-309":true,"vn-310":true,"vn-311":true,"vn-312":true,"vn-314":true,"vn-313":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-79 Testimonials", () => {
const Subject = Subject51;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-268" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-309":true,"vn-310":true,"vn-311":true,"vn-312":true,"vn-314":true,"vn-313":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-79 Testimonials", () => {
const Subject = Subject51;
it("[vi-315] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-313\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-315"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-309":true,"vn-310":true,"vn-311":true,"vn-312":true,"vn-314":true,"vn-313":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-80 FaqAccordion", () => {
const Subject = Subject52;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-316":true,"vn-317":true,"vn-318":true,"vn-319":true,"vn-321":true,"vn-320":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-80 FaqAccordion", () => {
const Subject = Subject52;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-316":true,"vn-317":true,"vn-318":true,"vn-319":true,"vn-321":true,"vn-320":true});
    for (const id of ["vn-320"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-80 FaqAccordion", () => {
const Subject = Subject52;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-316":true,"vn-317":true,"vn-318":true,"vn-319":true,"vn-321":true,"vn-320":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-80 FaqAccordion", () => {
const Subject = Subject52;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-316":true,"vn-317":true,"vn-318":true,"vn-319":true,"vn-321":true,"vn-320":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-80 FaqAccordion", () => {
const Subject = Subject52;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-316":true,"vn-317":true,"vn-318":true,"vn-319":true,"vn-321":true,"vn-320":true});
    for (const id of ["vn-320"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-80 FaqAccordion", () => {
const Subject = Subject52;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-276" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-316":true,"vn-317":true,"vn-318":true,"vn-319":true,"vn-321":true,"vn-320":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-80 FaqAccordion", () => {
const Subject = Subject52;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-277" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-316":true,"vn-317":true,"vn-318":true,"vn-319":true,"vn-321":true,"vn-320":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-80 FaqAccordion", () => {
const Subject = Subject52;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-278" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-316":true,"vn-317":true,"vn-318":true,"vn-319":true,"vn-321":true,"vn-320":true}); } finally { wrapper.unmount(); }
});
});
