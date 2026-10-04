// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import Subject38 from "../../../src/generated/presentation/components/library/content-table.vue";
import Subject39 from "../../../src/generated/presentation/components/library/content-board.vue";
import Subject40 from "../../../src/generated/presentation/components/library/content-detail.vue";
import Subject41 from "../../../src/generated/presentation/components/library/content-form.vue";
import Subject42 from "../../../src/generated/presentation/components/library/content-chart.vue";
import Subject43 from "../../../src/generated/presentation/components/library/content-media.vue";
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
describe("vc-66 TableBlock", () => {
const Subject = Subject38;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-213":true,"vn-214":true,"vn-215":true,"vn-216":true,"vn-219":true,"vn-217":true});
    for (const id of ["vn-217"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-66 TableBlock", () => {
const Subject = Subject38;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-136" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-213":true,"vn-214":true,"vn-215":true,"vn-216":true,"vn-219":true,"vn-217":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-66 TableBlock", () => {
const Subject = Subject38;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-137" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-213":true,"vn-214":true,"vn-215":true,"vn-216":true,"vn-219":true,"vn-217":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-66 TableBlock", () => {
const Subject = Subject38;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-138" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-213":true,"vn-214":true,"vn-215":true,"vn-216":true,"vn-219":true,"vn-217":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-66 TableBlock", () => {
const Subject = Subject38;
it("[vi-220] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-217\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-220"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-213":true,"vn-214":true,"vn-215":true,"vn-216":true,"vn-219":true,"vn-217":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-67 BoardBlock", () => {
const Subject = Subject39;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-221":true,"vn-222":true,"vn-223":true,"vn-226":true,"vn-227":true,"vn-228":true,"vn-229":true,"vn-224":true,"vn-230":true,"vn-225":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-67 BoardBlock", () => {
const Subject = Subject39;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-221":true,"vn-222":true,"vn-223":true,"vn-226":true,"vn-227":true,"vn-228":true,"vn-229":true,"vn-224":true,"vn-230":true,"vn-225":true});
    for (const id of ["vn-225"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-67 BoardBlock", () => {
const Subject = Subject39;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-221":true,"vn-222":true,"vn-223":true,"vn-226":true,"vn-227":true,"vn-228":true,"vn-229":true,"vn-224":true,"vn-230":true,"vn-225":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-67 BoardBlock", () => {
const Subject = Subject39;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-221":true,"vn-222":true,"vn-223":true,"vn-226":true,"vn-227":true,"vn-228":true,"vn-229":true,"vn-224":true,"vn-230":true,"vn-225":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-67 BoardBlock", () => {
const Subject = Subject39;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-221":true,"vn-222":true,"vn-223":true,"vn-226":true,"vn-227":true,"vn-228":true,"vn-229":true,"vn-224":true,"vn-230":true,"vn-225":true});
    for (const id of ["vn-225"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-67 BoardBlock", () => {
const Subject = Subject39;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-146" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-221":true,"vn-222":true,"vn-223":true,"vn-226":true,"vn-227":true,"vn-228":true,"vn-229":true,"vn-224":true,"vn-230":true,"vn-225":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-67 BoardBlock", () => {
const Subject = Subject39;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-147" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-221":true,"vn-222":true,"vn-223":true,"vn-226":true,"vn-227":true,"vn-228":true,"vn-229":true,"vn-224":true,"vn-230":true,"vn-225":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-67 BoardBlock", () => {
const Subject = Subject39;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-148" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-221":true,"vn-222":true,"vn-223":true,"vn-226":true,"vn-227":true,"vn-228":true,"vn-229":true,"vn-224":true,"vn-230":true,"vn-225":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-67 BoardBlock", () => {
const Subject = Subject39;
it("[vi-231] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-225\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-231"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-221":true,"vn-222":true,"vn-223":true,"vn-226":true,"vn-227":true,"vn-228":true,"vn-229":true,"vn-224":true,"vn-230":true,"vn-225":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-68 DetailBlock", () => {
const Subject = Subject40;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-232":true,"vn-233":true,"vn-234":true,"vn-235":true,"vn-237":true,"vn-236":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-68 DetailBlock", () => {
const Subject = Subject40;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-232":true,"vn-233":true,"vn-234":true,"vn-235":true,"vn-237":true,"vn-236":true});
    for (const id of ["vn-236"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-68 DetailBlock", () => {
const Subject = Subject40;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-232":true,"vn-233":true,"vn-234":true,"vn-235":true,"vn-237":true,"vn-236":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-68 DetailBlock", () => {
const Subject = Subject40;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-232":true,"vn-233":true,"vn-234":true,"vn-235":true,"vn-237":true,"vn-236":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-68 DetailBlock", () => {
const Subject = Subject40;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-232":true,"vn-233":true,"vn-234":true,"vn-235":true,"vn-237":true,"vn-236":true});
    for (const id of ["vn-236"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-68 DetailBlock", () => {
const Subject = Subject40;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-156" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-232":true,"vn-233":true,"vn-234":true,"vn-235":true,"vn-237":true,"vn-236":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-68 DetailBlock", () => {
const Subject = Subject40;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-157" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-232":true,"vn-233":true,"vn-234":true,"vn-235":true,"vn-237":true,"vn-236":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-68 DetailBlock", () => {
const Subject = Subject40;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-158" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-232":true,"vn-233":true,"vn-234":true,"vn-235":true,"vn-237":true,"vn-236":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-68 DetailBlock", () => {
const Subject = Subject40;
it("[vi-238] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-236\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-238"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-232":true,"vn-233":true,"vn-234":true,"vn-235":true,"vn-237":true,"vn-236":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-69 FormBlock", () => {
const Subject = Subject41;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-239":true,"vn-240":true,"vn-241":true,"vn-242":true,"vn-244":true,"vn-243":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-69 FormBlock", () => {
const Subject = Subject41;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-239":true,"vn-240":true,"vn-241":true,"vn-242":true,"vn-244":true,"vn-243":true});
    for (const id of ["vn-241","vn-243"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-69 FormBlock", () => {
const Subject = Subject41;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-239":true,"vn-240":true,"vn-241":true,"vn-242":true,"vn-244":true,"vn-243":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-69 FormBlock", () => {
const Subject = Subject41;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-239":true,"vn-240":true,"vn-241":true,"vn-242":true,"vn-244":true,"vn-243":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-69 FormBlock", () => {
const Subject = Subject41;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-239":true,"vn-240":true,"vn-241":true,"vn-242":true,"vn-244":true,"vn-243":true});
    for (const id of ["vn-241","vn-243"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-69 FormBlock", () => {
const Subject = Subject41;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-166" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-239":true,"vn-240":true,"vn-241":true,"vn-242":true,"vn-244":true,"vn-243":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-69 FormBlock", () => {
const Subject = Subject41;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-167" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-239":true,"vn-240":true,"vn-241":true,"vn-242":true,"vn-244":true,"vn-243":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-69 FormBlock", () => {
const Subject = Subject41;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-168" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-239":true,"vn-240":true,"vn-241":true,"vn-242":true,"vn-244":true,"vn-243":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-69 FormBlock", () => {
const Subject = Subject41;
it("[vi-245] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-243\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-245"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-239":true,"vn-240":true,"vn-241":true,"vn-242":true,"vn-244":true,"vn-243":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-70 ChartBlock", () => {
const Subject = Subject42;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-246":true,"vn-247":true,"vn-248":true,"vn-249":true,"vn-251":true,"vn-250":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-70 ChartBlock", () => {
const Subject = Subject42;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-246":true,"vn-247":true,"vn-248":true,"vn-249":true,"vn-251":true,"vn-250":true});
    for (const id of ["vn-250"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-70 ChartBlock", () => {
const Subject = Subject42;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-246":true,"vn-247":true,"vn-248":true,"vn-249":true,"vn-251":true,"vn-250":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-70 ChartBlock", () => {
const Subject = Subject42;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-246":true,"vn-247":true,"vn-248":true,"vn-249":true,"vn-251":true,"vn-250":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-70 ChartBlock", () => {
const Subject = Subject42;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-246":true,"vn-247":true,"vn-248":true,"vn-249":true,"vn-251":true,"vn-250":true});
    for (const id of ["vn-250"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-70 ChartBlock", () => {
const Subject = Subject42;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-176" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-246":true,"vn-247":true,"vn-248":true,"vn-249":true,"vn-251":true,"vn-250":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-70 ChartBlock", () => {
const Subject = Subject42;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-177" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-246":true,"vn-247":true,"vn-248":true,"vn-249":true,"vn-251":true,"vn-250":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-70 ChartBlock", () => {
const Subject = Subject42;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-178" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-246":true,"vn-247":true,"vn-248":true,"vn-249":true,"vn-251":true,"vn-250":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-70 ChartBlock", () => {
const Subject = Subject42;
it("[vi-252] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-250\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-252"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-246":true,"vn-247":true,"vn-248":true,"vn-249":true,"vn-251":true,"vn-250":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-71 MediaBlock", () => {
const Subject = Subject43;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-253":true,"vn-254":true,"vn-255":true,"vn-256":true,"vn-258":true,"vn-257":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-71 MediaBlock", () => {
const Subject = Subject43;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-253":true,"vn-254":true,"vn-255":true,"vn-256":true,"vn-258":true,"vn-257":true});
    for (const id of ["vn-257"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
