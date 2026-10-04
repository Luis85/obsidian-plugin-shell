// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import Subject52 from "../../../src/generated/presentation/components/library/pattern-faq.vue";
import Subject53 from "../../../src/generated/presentation/components/library/pattern-site-footer.vue";
import Subject54 from "../../../src/generated/presentation/components/library/pattern-image-gallery.vue";
import Subject55 from "../../../src/generated/presentation/components/library/pattern-contact.vue";
import Subject56 from "../../../src/generated/presentation/components/library/pattern-newsletter.vue";
import Subject57 from "../../../src/generated/presentation/components/library/pattern-article.vue";
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
describe("vc-80 FaqAccordion", () => {
const Subject = Subject52;
it("[vi-322] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-320\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-322"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-316":true,"vn-317":true,"vn-318":true,"vn-319":true,"vn-321":true,"vn-320":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-81 SiteFooter", () => {
const Subject = Subject53;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-323":true,"vn-324":true,"vn-325":true,"vn-326":true,"vn-328":true,"vn-327":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-81 SiteFooter", () => {
const Subject = Subject53;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-323":true,"vn-324":true,"vn-325":true,"vn-326":true,"vn-328":true,"vn-327":true});
    for (const id of ["vn-327"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-81 SiteFooter", () => {
const Subject = Subject53;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-323":true,"vn-324":true,"vn-325":true,"vn-326":true,"vn-328":true,"vn-327":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-81 SiteFooter", () => {
const Subject = Subject53;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-323":true,"vn-324":true,"vn-325":true,"vn-326":true,"vn-328":true,"vn-327":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-81 SiteFooter", () => {
const Subject = Subject53;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-323":true,"vn-324":true,"vn-325":true,"vn-326":true,"vn-328":true,"vn-327":true});
    for (const id of ["vn-327"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-81 SiteFooter", () => {
const Subject = Subject53;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-286" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-323":true,"vn-324":true,"vn-325":true,"vn-326":true,"vn-328":true,"vn-327":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-81 SiteFooter", () => {
const Subject = Subject53;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-287" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-323":true,"vn-324":true,"vn-325":true,"vn-326":true,"vn-328":true,"vn-327":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-81 SiteFooter", () => {
const Subject = Subject53;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-288" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-323":true,"vn-324":true,"vn-325":true,"vn-326":true,"vn-328":true,"vn-327":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-81 SiteFooter", () => {
const Subject = Subject53;
it("[vi-329] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-327\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-329"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-323":true,"vn-324":true,"vn-325":true,"vn-326":true,"vn-328":true,"vn-327":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-82 ImageGallery", () => {
const Subject = Subject54;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-330":true,"vn-331":true,"vn-332":true,"vn-333":true,"vn-335":true,"vn-334":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-82 ImageGallery", () => {
const Subject = Subject54;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-330":true,"vn-331":true,"vn-332":true,"vn-333":true,"vn-335":true,"vn-334":true});
    for (const id of ["vn-334"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-82 ImageGallery", () => {
const Subject = Subject54;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-330":true,"vn-331":true,"vn-332":true,"vn-333":true,"vn-335":true,"vn-334":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-82 ImageGallery", () => {
const Subject = Subject54;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-330":true,"vn-331":true,"vn-332":true,"vn-333":true,"vn-335":true,"vn-334":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-82 ImageGallery", () => {
const Subject = Subject54;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-330":true,"vn-331":true,"vn-332":true,"vn-333":true,"vn-335":true,"vn-334":true});
    for (const id of ["vn-334"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-82 ImageGallery", () => {
const Subject = Subject54;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-296" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-330":true,"vn-331":true,"vn-332":true,"vn-333":true,"vn-335":true,"vn-334":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-82 ImageGallery", () => {
const Subject = Subject54;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-297" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-330":true,"vn-331":true,"vn-332":true,"vn-333":true,"vn-335":true,"vn-334":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-82 ImageGallery", () => {
const Subject = Subject54;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-298" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-330":true,"vn-331":true,"vn-332":true,"vn-333":true,"vn-335":true,"vn-334":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-82 ImageGallery", () => {
const Subject = Subject54;
it("[vi-336] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-334\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-336"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-330":true,"vn-331":true,"vn-332":true,"vn-333":true,"vn-335":true,"vn-334":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-83 ContactForm", () => {
const Subject = Subject55;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-337":true,"vn-338":true,"vn-339":true,"vn-340":true,"vn-342":true,"vn-341":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-83 ContactForm", () => {
const Subject = Subject55;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-337":true,"vn-338":true,"vn-339":true,"vn-340":true,"vn-342":true,"vn-341":true});
    for (const id of ["vn-341"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-83 ContactForm", () => {
const Subject = Subject55;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-337":true,"vn-338":true,"vn-339":true,"vn-340":true,"vn-342":true,"vn-341":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-83 ContactForm", () => {
const Subject = Subject55;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-337":true,"vn-338":true,"vn-339":true,"vn-340":true,"vn-342":true,"vn-341":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-83 ContactForm", () => {
const Subject = Subject55;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-337":true,"vn-338":true,"vn-339":true,"vn-340":true,"vn-342":true,"vn-341":true});
    for (const id of ["vn-341"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-83 ContactForm", () => {
const Subject = Subject55;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-306" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-337":true,"vn-338":true,"vn-339":true,"vn-340":true,"vn-342":true,"vn-341":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-83 ContactForm", () => {
const Subject = Subject55;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-307" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-337":true,"vn-338":true,"vn-339":true,"vn-340":true,"vn-342":true,"vn-341":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-83 ContactForm", () => {
const Subject = Subject55;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-308" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-337":true,"vn-338":true,"vn-339":true,"vn-340":true,"vn-342":true,"vn-341":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-83 ContactForm", () => {
const Subject = Subject55;
it("[vi-343] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-341\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-343"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-337":true,"vn-338":true,"vn-339":true,"vn-340":true,"vn-342":true,"vn-341":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-84 NewsletterSignup", () => {
const Subject = Subject56;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-344":true,"vn-345":true,"vn-346":true,"vn-347":true,"vn-349":true,"vn-348":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-84 NewsletterSignup", () => {
const Subject = Subject56;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-344":true,"vn-345":true,"vn-346":true,"vn-347":true,"vn-349":true,"vn-348":true});
    for (const id of ["vn-346","vn-348"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-84 NewsletterSignup", () => {
const Subject = Subject56;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-344":true,"vn-345":true,"vn-346":true,"vn-347":true,"vn-349":true,"vn-348":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-84 NewsletterSignup", () => {
const Subject = Subject56;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-344":true,"vn-345":true,"vn-346":true,"vn-347":true,"vn-349":true,"vn-348":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-84 NewsletterSignup", () => {
const Subject = Subject56;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-344":true,"vn-345":true,"vn-346":true,"vn-347":true,"vn-349":true,"vn-348":true});
    for (const id of ["vn-346","vn-348"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-84 NewsletterSignup", () => {
const Subject = Subject56;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-316" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-344":true,"vn-345":true,"vn-346":true,"vn-347":true,"vn-349":true,"vn-348":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-84 NewsletterSignup", () => {
const Subject = Subject56;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-317" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-344":true,"vn-345":true,"vn-346":true,"vn-347":true,"vn-349":true,"vn-348":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-84 NewsletterSignup", () => {
const Subject = Subject56;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-318" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-344":true,"vn-345":true,"vn-346":true,"vn-347":true,"vn-349":true,"vn-348":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-84 NewsletterSignup", () => {
const Subject = Subject56;
it("[vi-350] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-348\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-350"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-344":true,"vn-345":true,"vn-346":true,"vn-347":true,"vn-349":true,"vn-348":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-85 ArticleBody", () => {
const Subject = Subject57;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-351":true,"vn-352":true,"vn-353":true,"vn-354":true,"vn-356":true,"vn-355":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-85 ArticleBody", () => {
const Subject = Subject57;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-351":true,"vn-352":true,"vn-353":true,"vn-354":true,"vn-356":true,"vn-355":true});
    for (const id of ["vn-355"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-85 ArticleBody", () => {
const Subject = Subject57;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-351":true,"vn-352":true,"vn-353":true,"vn-354":true,"vn-356":true,"vn-355":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-85 ArticleBody", () => {
const Subject = Subject57;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-351":true,"vn-352":true,"vn-353":true,"vn-354":true,"vn-356":true,"vn-355":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-85 ArticleBody", () => {
const Subject = Subject57;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-351":true,"vn-352":true,"vn-353":true,"vn-354":true,"vn-356":true,"vn-355":true});
    for (const id of ["vn-355"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-85 ArticleBody", () => {
const Subject = Subject57;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-326" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-351":true,"vn-352":true,"vn-353":true,"vn-354":true,"vn-356":true,"vn-355":true}); } finally { wrapper.unmount(); }
});
});
