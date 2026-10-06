// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import Subject33 from "../../../src/generated/presentation/components/library/content-heading.vue";
import Subject34 from "../../../src/generated/presentation/components/library/content-text.vue";
import Subject35 from "../../../src/generated/presentation/components/library/content-navigation.vue";
import Subject36 from "../../../src/generated/presentation/components/library/content-toolbar.vue";
import Subject37 from "../../../src/generated/presentation/components/library/content-list.vue";
import Subject38 from "../../../src/generated/presentation/components/library/content-table.vue";
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
describe("vc-61 HeadingBlock", () => {
const Subject = Subject33;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-87" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-170":true,"vn-171":true,"vn-172":true,"vn-173":true,"vn-175":true,"vn-174":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-61 HeadingBlock", () => {
const Subject = Subject33;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-88" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-170":true,"vn-171":true,"vn-172":true,"vn-173":true,"vn-175":true,"vn-174":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-61 HeadingBlock", () => {
const Subject = Subject33;
it("[vi-176] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-174\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-176"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-170":true,"vn-171":true,"vn-172":true,"vn-173":true,"vn-175":true,"vn-174":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-62 TextBlock", () => {
const Subject = Subject34;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-177":true,"vn-178":true,"vn-179":true,"vn-180":true,"vn-182":true,"vn-181":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-62 TextBlock", () => {
const Subject = Subject34;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-177":true,"vn-178":true,"vn-179":true,"vn-180":true,"vn-182":true,"vn-181":true});
    for (const id of ["vn-181"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-62 TextBlock", () => {
const Subject = Subject34;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-177":true,"vn-178":true,"vn-179":true,"vn-180":true,"vn-182":true,"vn-181":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-62 TextBlock", () => {
const Subject = Subject34;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-177":true,"vn-178":true,"vn-179":true,"vn-180":true,"vn-182":true,"vn-181":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-62 TextBlock", () => {
const Subject = Subject34;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-177":true,"vn-178":true,"vn-179":true,"vn-180":true,"vn-182":true,"vn-181":true});
    for (const id of ["vn-181"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-62 TextBlock", () => {
const Subject = Subject34;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-96" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-177":true,"vn-178":true,"vn-179":true,"vn-180":true,"vn-182":true,"vn-181":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-62 TextBlock", () => {
const Subject = Subject34;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-97" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-177":true,"vn-178":true,"vn-179":true,"vn-180":true,"vn-182":true,"vn-181":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-62 TextBlock", () => {
const Subject = Subject34;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-98" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-177":true,"vn-178":true,"vn-179":true,"vn-180":true,"vn-182":true,"vn-181":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-62 TextBlock", () => {
const Subject = Subject34;
it("[vi-183] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-181\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-183"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-177":true,"vn-178":true,"vn-179":true,"vn-180":true,"vn-182":true,"vn-181":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-63 NavigationBlock", () => {
const Subject = Subject35;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-184":true,"vn-185":true,"vn-186":true,"vn-189":true,"vn-190":true,"vn-191":true,"vn-192":true,"vn-187":true,"vn-193":true,"vn-188":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-63 NavigationBlock", () => {
const Subject = Subject35;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-184":true,"vn-185":true,"vn-186":true,"vn-189":true,"vn-190":true,"vn-191":true,"vn-192":true,"vn-187":true,"vn-193":true,"vn-188":true});
    for (const id of ["vn-188"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-63 NavigationBlock", () => {
const Subject = Subject35;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-184":true,"vn-185":true,"vn-186":true,"vn-189":true,"vn-190":true,"vn-191":true,"vn-192":true,"vn-187":true,"vn-193":true,"vn-188":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-63 NavigationBlock", () => {
const Subject = Subject35;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-184":true,"vn-185":true,"vn-186":true,"vn-189":true,"vn-190":true,"vn-191":true,"vn-192":true,"vn-187":true,"vn-193":true,"vn-188":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-63 NavigationBlock", () => {
const Subject = Subject35;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-184":true,"vn-185":true,"vn-186":true,"vn-189":true,"vn-190":true,"vn-191":true,"vn-192":true,"vn-187":true,"vn-193":true,"vn-188":true});
    for (const id of ["vn-188"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-63 NavigationBlock", () => {
const Subject = Subject35;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-106" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-184":true,"vn-185":true,"vn-186":true,"vn-189":true,"vn-190":true,"vn-191":true,"vn-192":true,"vn-187":true,"vn-193":true,"vn-188":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-63 NavigationBlock", () => {
const Subject = Subject35;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-107" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-184":true,"vn-185":true,"vn-186":true,"vn-189":true,"vn-190":true,"vn-191":true,"vn-192":true,"vn-187":true,"vn-193":true,"vn-188":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-63 NavigationBlock", () => {
const Subject = Subject35;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-108" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-184":true,"vn-185":true,"vn-186":true,"vn-189":true,"vn-190":true,"vn-191":true,"vn-192":true,"vn-187":true,"vn-193":true,"vn-188":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-63 NavigationBlock", () => {
const Subject = Subject35;
it("[vi-194] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-188\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-194"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-184":true,"vn-185":true,"vn-186":true,"vn-189":true,"vn-190":true,"vn-191":true,"vn-192":true,"vn-187":true,"vn-193":true,"vn-188":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-64 ToolbarBlock", () => {
const Subject = Subject36;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-195":true,"vn-196":true,"vn-197":true,"vn-198":true,"vn-200":true,"vn-199":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-64 ToolbarBlock", () => {
const Subject = Subject36;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-195":true,"vn-196":true,"vn-197":true,"vn-198":true,"vn-200":true,"vn-199":true});
    for (const id of ["vn-199"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-64 ToolbarBlock", () => {
const Subject = Subject36;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-195":true,"vn-196":true,"vn-197":true,"vn-198":true,"vn-200":true,"vn-199":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-64 ToolbarBlock", () => {
const Subject = Subject36;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-195":true,"vn-196":true,"vn-197":true,"vn-198":true,"vn-200":true,"vn-199":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-64 ToolbarBlock", () => {
const Subject = Subject36;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-195":true,"vn-196":true,"vn-197":true,"vn-198":true,"vn-200":true,"vn-199":true});
    for (const id of ["vn-199"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-64 ToolbarBlock", () => {
const Subject = Subject36;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-116" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-195":true,"vn-196":true,"vn-197":true,"vn-198":true,"vn-200":true,"vn-199":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-64 ToolbarBlock", () => {
const Subject = Subject36;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-117" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-195":true,"vn-196":true,"vn-197":true,"vn-198":true,"vn-200":true,"vn-199":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-64 ToolbarBlock", () => {
const Subject = Subject36;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-118" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-195":true,"vn-196":true,"vn-197":true,"vn-198":true,"vn-200":true,"vn-199":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-64 ToolbarBlock", () => {
const Subject = Subject36;
it("[vi-201] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-199\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-201"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-195":true,"vn-196":true,"vn-197":true,"vn-198":true,"vn-200":true,"vn-199":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-65 ListBlock", () => {
const Subject = Subject37;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-202":true,"vn-203":true,"vn-204":true,"vn-207":true,"vn-208":true,"vn-209":true,"vn-210":true,"vn-205":true,"vn-211":true,"vn-206":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-65 ListBlock", () => {
const Subject = Subject37;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-202":true,"vn-203":true,"vn-204":true,"vn-207":true,"vn-208":true,"vn-209":true,"vn-210":true,"vn-205":true,"vn-211":true,"vn-206":true});
    for (const id of ["vn-206"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-65 ListBlock", () => {
const Subject = Subject37;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-202":true,"vn-203":true,"vn-204":true,"vn-207":true,"vn-208":true,"vn-209":true,"vn-210":true,"vn-205":true,"vn-211":true,"vn-206":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-65 ListBlock", () => {
const Subject = Subject37;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-202":true,"vn-203":true,"vn-204":true,"vn-207":true,"vn-208":true,"vn-209":true,"vn-210":true,"vn-205":true,"vn-211":true,"vn-206":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-65 ListBlock", () => {
const Subject = Subject37;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-202":true,"vn-203":true,"vn-204":true,"vn-207":true,"vn-208":true,"vn-209":true,"vn-210":true,"vn-205":true,"vn-211":true,"vn-206":true});
    for (const id of ["vn-206"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-65 ListBlock", () => {
const Subject = Subject37;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-126" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-202":true,"vn-203":true,"vn-204":true,"vn-207":true,"vn-208":true,"vn-209":true,"vn-210":true,"vn-205":true,"vn-211":true,"vn-206":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-65 ListBlock", () => {
const Subject = Subject37;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-127" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-202":true,"vn-203":true,"vn-204":true,"vn-207":true,"vn-208":true,"vn-209":true,"vn-210":true,"vn-205":true,"vn-211":true,"vn-206":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-65 ListBlock", () => {
const Subject = Subject37;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-128" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-202":true,"vn-203":true,"vn-204":true,"vn-207":true,"vn-208":true,"vn-209":true,"vn-210":true,"vn-205":true,"vn-211":true,"vn-206":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-65 ListBlock", () => {
const Subject = Subject37;
it("[vi-212] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-206\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-212"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-202":true,"vn-203":true,"vn-204":true,"vn-207":true,"vn-208":true,"vn-209":true,"vn-210":true,"vn-205":true,"vn-211":true,"vn-206":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-66 TableBlock", () => {
const Subject = Subject38;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-213":true,"vn-214":true,"vn-215":true,"vn-216":true,"vn-219":true,"vn-217":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-66 TableBlock", () => {
const Subject = Subject38;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-213":true,"vn-214":true,"vn-215":true,"vn-216":true,"vn-219":true,"vn-217":true});
    for (const id of ["vn-217"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-66 TableBlock", () => {
const Subject = Subject38;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-213":true,"vn-214":true,"vn-215":true,"vn-216":true,"vn-219":true,"vn-217":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-66 TableBlock", () => {
const Subject = Subject38;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-213":true,"vn-214":true,"vn-215":true,"vn-216":true,"vn-219":true,"vn-217":true});
  } finally { wrapper.unmount(); }
});
});
