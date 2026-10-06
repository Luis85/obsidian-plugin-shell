// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import Subject76 from "../../../src/generated/presentation/components/library/test-operation-panel.vue";
import Subject77 from "../../../src/generated/presentation/components/library/design-token-editor.vue";
import Subject78 from "../../../src/generated/presentation/components/library/component-contract-panel.vue";
import Subject79 from "../../../src/generated/presentation/components/library/project-json-review.vue";
import Subject80 from "../../../src/generated/presentation/components/library/shell-handoff-panel.vue";
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
describe("vc-104 TestOperationPanel", () => {
const Subject = Subject76;
it("[vi-509] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture","busy":false}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-507\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-509"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-503":true,"vn-504":true,"vn-505":true,"vn-506":true,"vn-508":true,"vn-507":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-105 DesignTokenEditor", () => {
const Subject = Subject77;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-510":true,"vn-511":true,"vn-512":true,"vn-513":true,"vn-515":true,"vn-514":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-105 DesignTokenEditor", () => {
const Subject = Subject77;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-510":true,"vn-511":true,"vn-512":true,"vn-513":true,"vn-515":true,"vn-514":true});
    for (const id of ["vn-512","vn-514"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-105 DesignTokenEditor", () => {
const Subject = Subject77;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-510":true,"vn-511":true,"vn-512":true,"vn-513":true,"vn-515":true,"vn-514":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-105 DesignTokenEditor", () => {
const Subject = Subject77;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-510":true,"vn-511":true,"vn-512":true,"vn-513":true,"vn-515":true,"vn-514":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-105 DesignTokenEditor", () => {
const Subject = Subject77;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-510":true,"vn-511":true,"vn-512":true,"vn-513":true,"vn-515":true,"vn-514":true});
    for (const id of ["vn-512","vn-514"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-105 DesignTokenEditor", () => {
const Subject = Subject77;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designScenario: "scenario-526" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-510":true,"vn-511":true,"vn-512":true,"vn-513":true,"vn-515":true,"vn-514":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-105 DesignTokenEditor", () => {
const Subject = Subject77;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designScenario: "scenario-527" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-510":true,"vn-511":true,"vn-512":true,"vn-513":true,"vn-515":true,"vn-514":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-105 DesignTokenEditor", () => {
const Subject = Subject77;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designScenario: "scenario-528" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-510":true,"vn-511":true,"vn-512":true,"vn-513":true,"vn-515":true,"vn-514":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-105 DesignTokenEditor", () => {
const Subject = Subject77;
it("[vi-516] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture","busy":false}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-514\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-516"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-510":true,"vn-511":true,"vn-512":true,"vn-513":true,"vn-515":true,"vn-514":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-106 ComponentContractPanel", () => {
const Subject = Subject78;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-517":true,"vn-518":true,"vn-519":true,"vn-520":true,"vn-522":true,"vn-521":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-106 ComponentContractPanel", () => {
const Subject = Subject78;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-517":true,"vn-518":true,"vn-519":true,"vn-520":true,"vn-522":true,"vn-521":true});
    for (const id of ["vn-519","vn-521"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-106 ComponentContractPanel", () => {
const Subject = Subject78;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-517":true,"vn-518":true,"vn-519":true,"vn-520":true,"vn-522":true,"vn-521":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-106 ComponentContractPanel", () => {
const Subject = Subject78;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-517":true,"vn-518":true,"vn-519":true,"vn-520":true,"vn-522":true,"vn-521":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-106 ComponentContractPanel", () => {
const Subject = Subject78;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-517":true,"vn-518":true,"vn-519":true,"vn-520":true,"vn-522":true,"vn-521":true});
    for (const id of ["vn-519","vn-521"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-106 ComponentContractPanel", () => {
const Subject = Subject78;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designScenario: "scenario-536" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-517":true,"vn-518":true,"vn-519":true,"vn-520":true,"vn-522":true,"vn-521":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-106 ComponentContractPanel", () => {
const Subject = Subject78;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designScenario: "scenario-537" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-517":true,"vn-518":true,"vn-519":true,"vn-520":true,"vn-522":true,"vn-521":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-106 ComponentContractPanel", () => {
const Subject = Subject78;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designScenario: "scenario-538" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-517":true,"vn-518":true,"vn-519":true,"vn-520":true,"vn-522":true,"vn-521":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-106 ComponentContractPanel", () => {
const Subject = Subject78;
it("[vi-523] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture","busy":false}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-521\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-523"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-517":true,"vn-518":true,"vn-519":true,"vn-520":true,"vn-522":true,"vn-521":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-107 ProjectJsonReview", () => {
const Subject = Subject79;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-109":true,"vn-110":true,"vn-111":true,"vn-113":true,"vn-112":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-107 ProjectJsonReview", () => {
const Subject = Subject79;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-109":true,"vn-110":true,"vn-111":true,"vn-113":true,"vn-112":true});
    for (const id of ["vn-112"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-107 ProjectJsonReview", () => {
const Subject = Subject79;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-109":true,"vn-110":true,"vn-111":true,"vn-113":true,"vn-112":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-107 ProjectJsonReview", () => {
const Subject = Subject79;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-109":true,"vn-110":true,"vn-111":true,"vn-113":true,"vn-112":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-107 ProjectJsonReview", () => {
const Subject = Subject79;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-109":true,"vn-110":true,"vn-111":true,"vn-113":true,"vn-112":true});
    for (const id of ["vn-112"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-107 ProjectJsonReview", () => {
const Subject = Subject79;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designScenario: "scenario-1025" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-109":true,"vn-110":true,"vn-111":true,"vn-113":true,"vn-112":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-107 ProjectJsonReview", () => {
const Subject = Subject79;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designScenario: "scenario-1026" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-109":true,"vn-110":true,"vn-111":true,"vn-113":true,"vn-112":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-107 ProjectJsonReview", () => {
const Subject = Subject79;
it("[vi-114] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture","busy":false}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-112\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-114"]);
    expect(f.handle.mock.calls.map(([request]) => request.interactionId)).toEqual(["vi-114"]);
    expect(f.navigate).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); }
});
});
describe("vc-108 ShellHandoffPanel", () => {
const Subject = Subject80;
it("renders declared default visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-524":true,"vn-525":true,"vn-526":true,"vn-527":true,"vn-529":true,"vn-528":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-108 ShellHandoffPanel", () => {
const Subject = Subject80;
it("renders declared loading visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "loading" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-524":true,"vn-525":true,"vn-526":true,"vn-527":true,"vn-529":true,"vn-528":true});
    for (const id of ["vn-528"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-108 ShellHandoffPanel", () => {
const Subject = Subject80;
it("renders declared empty visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "empty" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-524":true,"vn-525":true,"vn-526":true,"vn-527":true,"vn-529":true,"vn-528":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-108 ShellHandoffPanel", () => {
const Subject = Subject80;
it("renders declared error visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-524":true,"vn-525":true,"vn-526":true,"vn-527":true,"vn-529":true,"vn-528":true});
  } finally { wrapper.unmount(); }
});
});
describe("vc-108 ShellHandoffPanel", () => {
const Subject = Subject80;
it("renders declared disabled visibility including hidden ancestors", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designState: "disabled" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, {"vn-524":true,"vn-525":true,"vn-526":true,"vn-527":true,"vn-529":true,"vn-528":true});
    for (const id of ["vn-528"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);
  } finally { wrapper.unmount(); }
});
});
describe("vc-108 ShellHandoffPanel", () => {
const Subject = Subject80;
it("scenario Default example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designScenario: "scenario-546" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-524":true,"vn-525":true,"vn-526":true,"vn-527":true,"vn-529":true,"vn-528":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-108 ShellHandoffPanel", () => {
const Subject = Subject80;
it("scenario Narrow example renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designScenario: "scenario-547" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("default"); expectVisible(wrapper.element, {"vn-524":true,"vn-525":true,"vn-526":true,"vn-527":true,"vn-529":true,"vn-528":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-108 ShellHandoffPanel", () => {
const Subject = Subject80;
it("scenario Error feedback renders its state and visibility", () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...{"title":"fixture","busy":false}, designScenario: "scenario-548" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe("error"); expectVisible(wrapper.element, {"vn-524":true,"vn-525":true,"vn-526":true,"vn-527":true,"vn-529":true,"vn-528":true}); } finally { wrapper.unmount(); }
});
});
describe("vc-108 ShellHandoffPanel", () => {
const Subject = Subject80;
it("[vi-530] dispatches the designed click interaction", async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture","busy":false}, designState: "default" }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    await wrapper.get("[data-design-node=\"vn-528\"]").trigger("click"); await flushPromises();
    expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-1)).toEqual(["vi-530"]);
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(wrapper.attributes('data-design-state')).toBe("error");
    expectVisible(wrapper.element, {"vn-524":true,"vn-525":true,"vn-526":true,"vn-527":true,"vn-529":true,"vn-528":true});
  } finally { wrapper.unmount(); }
});
});
