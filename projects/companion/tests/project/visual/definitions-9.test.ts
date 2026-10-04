// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import Subject28 from "../../../src/generated/presentation/components/library/capture-form.vue";
import Subject29 from "../../../src/generated/presentation/components/library/empty-state.vue";
import Subject30 from "../../../src/generated/presentation/components/library/filter-toolbar.vue";
import Subject31 from "../../../src/generated/presentation/components/library/status-notice.vue";
import Subject32 from "../../../src/generated/presentation/components/library/property-editor.vue";
import Subject33 from "../../../src/generated/presentation/components/library/content-heading.vue";
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
describe("vc-56 CaptureForm", () => {
const Subject = Subject28;
it("[vi-141] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture","busy":false}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-139\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-141"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-135":true,"vn-136":true,"vn-137":true,"vn-138":true,"vn-140":true,"vn-139":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-57 EmptyState", () => {
const Subject = Subject29;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","description":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-142":true,"vn-143":true,"vn-144":true,"vn-145":true,"vn-147":true,"vn-146":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-57 EmptyState", () => {
const Subject = Subject29;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","description":"fixture"}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-142":true,"vn-143":true,"vn-144":true,"vn-145":true,"vn-147":true,"vn-146":true});
    for (const id of ["vn-146"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-57 EmptyState", () => {
const Subject = Subject29;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","description":"fixture"}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-142":true,"vn-143":true,"vn-144":true,"vn-145":true,"vn-147":true,"vn-146":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-57 EmptyState", () => {
const Subject = Subject29;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","description":"fixture"}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-142":true,"vn-143":true,"vn-144":true,"vn-145":true,"vn-147":true,"vn-146":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-57 EmptyState", () => {
const Subject = Subject29;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","description":"fixture"}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-142":true,"vn-143":true,"vn-144":true,"vn-145":true,"vn-147":true,"vn-146":true});
    for (const id of ["vn-146"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-57 EmptyState", () => {
const Subject = Subject29;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","description":"fixture"}, designScenario: "scenario-46" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-142":true,"vn-143":true,"vn-144":true,"vn-145":true,"vn-147":true,"vn-146":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-57 EmptyState", () => {
const Subject = Subject29;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","description":"fixture"}, designScenario: "scenario-47" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-142":true,"vn-143":true,"vn-144":true,"vn-145":true,"vn-147":true,"vn-146":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-57 EmptyState", () => {
const Subject = Subject29;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","description":"fixture"}, designScenario: "scenario-48" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-142":true,"vn-143":true,"vn-144":true,"vn-145":true,"vn-147":true,"vn-146":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-57 EmptyState", () => {
const Subject = Subject29;
it("[vi-148] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture","description":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-146\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-148"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-142":true,"vn-143":true,"vn-144":true,"vn-145":true,"vn-147":true,"vn-146":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-58 FilterToolbar", () => {
const Subject = Subject30;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"query":"fixture","count":0}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-149":true,"vn-150":true,"vn-151":true,"vn-152":true,"vn-154":true,"vn-153":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-58 FilterToolbar", () => {
const Subject = Subject30;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"query":"fixture","count":0}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-149":true,"vn-150":true,"vn-151":true,"vn-152":true,"vn-154":true,"vn-153":true});
    for (const id of ["vn-151","vn-153"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-58 FilterToolbar", () => {
const Subject = Subject30;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"query":"fixture","count":0}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-149":true,"vn-150":true,"vn-151":true,"vn-152":true,"vn-154":true,"vn-153":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-58 FilterToolbar", () => {
const Subject = Subject30;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"query":"fixture","count":0}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-149":true,"vn-150":true,"vn-151":true,"vn-152":true,"vn-154":true,"vn-153":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-58 FilterToolbar", () => {
const Subject = Subject30;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"query":"fixture","count":0}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-149":true,"vn-150":true,"vn-151":true,"vn-152":true,"vn-154":true,"vn-153":true});
    for (const id of ["vn-151","vn-153"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-58 FilterToolbar", () => {
const Subject = Subject30;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"query":"fixture","count":0}, designScenario: "scenario-56" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-149":true,"vn-150":true,"vn-151":true,"vn-152":true,"vn-154":true,"vn-153":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-58 FilterToolbar", () => {
const Subject = Subject30;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"query":"fixture","count":0}, designScenario: "scenario-57" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-149":true,"vn-150":true,"vn-151":true,"vn-152":true,"vn-154":true,"vn-153":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-58 FilterToolbar", () => {
const Subject = Subject30;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"query":"fixture","count":0}, designScenario: "scenario-58" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-149":true,"vn-150":true,"vn-151":true,"vn-152":true,"vn-154":true,"vn-153":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-58 FilterToolbar", () => {
const Subject = Subject30;
it("[vi-155] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"query":"fixture","count":0}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-153\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-155"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-149":true,"vn-150":true,"vn-151":true,"vn-152":true,"vn-154":true,"vn-153":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-59 StatusNotice", () => {
const Subject = Subject31;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"message":"fixture","busy":false}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-156":true,"vn-157":true,"vn-158":true,"vn-159":true,"vn-161":true,"vn-160":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-59 StatusNotice", () => {
const Subject = Subject31;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"message":"fixture","busy":false}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-156":true,"vn-157":true,"vn-158":true,"vn-159":true,"vn-161":true,"vn-160":true});
    for (const id of ["vn-160"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-59 StatusNotice", () => {
const Subject = Subject31;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"message":"fixture","busy":false}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-156":true,"vn-157":true,"vn-158":true,"vn-159":true,"vn-161":true,"vn-160":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-59 StatusNotice", () => {
const Subject = Subject31;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"message":"fixture","busy":false}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-156":true,"vn-157":true,"vn-158":true,"vn-159":true,"vn-161":true,"vn-160":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-59 StatusNotice", () => {
const Subject = Subject31;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"message":"fixture","busy":false}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-156":true,"vn-157":true,"vn-158":true,"vn-159":true,"vn-161":true,"vn-160":true});
    for (const id of ["vn-160"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-59 StatusNotice", () => {
const Subject = Subject31;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"message":"fixture","busy":false}, designScenario: "scenario-66" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-156":true,"vn-157":true,"vn-158":true,"vn-159":true,"vn-161":true,"vn-160":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-59 StatusNotice", () => {
const Subject = Subject31;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"message":"fixture","busy":false}, designScenario: "scenario-67" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-156":true,"vn-157":true,"vn-158":true,"vn-159":true,"vn-161":true,"vn-160":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-59 StatusNotice", () => {
const Subject = Subject31;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"message":"fixture","busy":false}, designScenario: "scenario-68" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-156":true,"vn-157":true,"vn-158":true,"vn-159":true,"vn-161":true,"vn-160":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-59 StatusNotice", () => {
const Subject = Subject31;
it("[vi-162] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"message":"fixture","busy":false}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-160\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-162"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-156":true,"vn-157":true,"vn-158":true,"vn-159":true,"vn-161":true,"vn-160":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-60 PropertyEditor", () => {
const Subject = Subject32;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"label":"fixture","value":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-163":true,"vn-164":true,"vn-165":true,"vn-166":true,"vn-168":true,"vn-167":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-60 PropertyEditor", () => {
const Subject = Subject32;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"label":"fixture","value":"fixture"}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-163":true,"vn-164":true,"vn-165":true,"vn-166":true,"vn-168":true,"vn-167":true});
    for (const id of ["vn-165","vn-167"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-60 PropertyEditor", () => {
const Subject = Subject32;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"label":"fixture","value":"fixture"}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-163":true,"vn-164":true,"vn-165":true,"vn-166":true,"vn-168":true,"vn-167":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-60 PropertyEditor", () => {
const Subject = Subject32;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"label":"fixture","value":"fixture"}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-163":true,"vn-164":true,"vn-165":true,"vn-166":true,"vn-168":true,"vn-167":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-60 PropertyEditor", () => {
const Subject = Subject32;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"label":"fixture","value":"fixture"}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-163":true,"vn-164":true,"vn-165":true,"vn-166":true,"vn-168":true,"vn-167":true});
    for (const id of ["vn-165","vn-167"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-60 PropertyEditor", () => {
const Subject = Subject32;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"label":"fixture","value":"fixture"}, designScenario: "scenario-76" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-163":true,"vn-164":true,"vn-165":true,"vn-166":true,"vn-168":true,"vn-167":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-60 PropertyEditor", () => {
const Subject = Subject32;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"label":"fixture","value":"fixture"}, designScenario: "scenario-77" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-163":true,"vn-164":true,"vn-165":true,"vn-166":true,"vn-168":true,"vn-167":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-60 PropertyEditor", () => {
const Subject = Subject32;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"label":"fixture","value":"fixture"}, designScenario: "scenario-78" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-163":true,"vn-164":true,"vn-165":true,"vn-166":true,"vn-168":true,"vn-167":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-60 PropertyEditor", () => {
const Subject = Subject32;
it("[vi-169] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"label":"fixture","value":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-167\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-169"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-163":true,"vn-164":true,"vn-165":true,"vn-166":true,"vn-168":true,"vn-167":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-61 HeadingBlock", () => {
const Subject = Subject33;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-170":true,"vn-171":true,"vn-172":true,"vn-173":true,"vn-175":true,"vn-174":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-61 HeadingBlock", () => {
const Subject = Subject33;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-170":true,"vn-171":true,"vn-172":true,"vn-173":true,"vn-175":true,"vn-174":true});
    for (const id of ["vn-174"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-61 HeadingBlock", () => {
const Subject = Subject33;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-170":true,"vn-171":true,"vn-172":true,"vn-173":true,"vn-175":true,"vn-174":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-61 HeadingBlock", () => {
const Subject = Subject33;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-170":true,"vn-171":true,"vn-172":true,"vn-173":true,"vn-175":true,"vn-174":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-61 HeadingBlock", () => {
const Subject = Subject33;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-170":true,"vn-171":true,"vn-172":true,"vn-173":true,"vn-175":true,"vn-174":true});
    for (const id of ["vn-174"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-61 HeadingBlock", () => {
const Subject = Subject33;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture"}, designScenario: "scenario-86" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-170":true,"vn-171":true,"vn-172":true,"vn-173":true,"vn-175":true,"vn-174":true}); } finally { wrapper.unmount(); }
});
});
