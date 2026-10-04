import { it, expect } from 'vitest';
import { createPinia, disposePinia } from 'pinia';
import { createGTestRecipesService } from "../../../src/generated/application/test-recipes/service.ts";
import { defineGTestRecipesStore } from "../../../src/generated/presentation/stores/test-recipes.ts";
import type { GTestRecipesPort } from "../../../src/generated/application/test-recipes/contracts.ts";
const fixture = (): GTestRecipesPort => ({"list": async () => ([{"record":{"id":"fixture","type":"test-recipe","title":"fixture"},"revision":1}]),
"create": async () => ({"record":{"id":"fixture","type":"test-recipe","title":"fixture"},"revision":1}),
"update": async () => ({"record":{"id":"fixture","type":"test-recipe","title":"fixture"},"revision":1}),
"delete": async () => (undefined)});
it("list executes the real service and Pinia state", async () => {
  const pinia = createPinia();
  try { const service = createGTestRecipesService(fixture()); const state = defineGTestRecipesStore(service)(pinia);
    expect((await state["list"].execute(undefined)).ok).toBe(true);
    expect(state["list"].data).toEqual([{"record":{"id":"fixture","type":"test-recipe","title":"fixture"},"revision":1}]); expect(state["list"].pending).toBe(false);
  } finally { disposePinia(pinia); }
});

it("list reports adapter failure without success", async () => {
  const pinia = createPinia();
  try { const port = fixture(); port["list"] = async () => { throw new Error('fixture'); };
    const state = defineGTestRecipesStore(createGTestRecipesService(port))(pinia);
    expect((await state["list"].execute(undefined)).ok).toBe(false);
    expect(state["list"].data).toBe(null); expect(state["list"].error).toBe('operation-failed');
  } finally { disposePinia(pinia); }
});

it("create executes the real service and Pinia state", async () => {
  const pinia = createPinia();
  try { const service = createGTestRecipesService(fixture()); const state = defineGTestRecipesStore(service)(pinia);
    expect((await state["create"].execute({"values":{"title":"fixture"},"requestId":"fixture"})).ok).toBe(true);
    expect(state["create"].data).toEqual({"record":{"id":"fixture","type":"test-recipe","title":"fixture"},"revision":1}); expect(state["create"].pending).toBe(false);
  } finally { disposePinia(pinia); }
});

it("create reports adapter failure without success", async () => {
  const pinia = createPinia();
  try { const port = fixture(); port["create"] = async () => { throw new Error('fixture'); };
    const state = defineGTestRecipesStore(createGTestRecipesService(port))(pinia);
    expect((await state["create"].execute({"values":{"title":"fixture"},"requestId":"fixture"})).ok).toBe(false);
    expect(state["create"].data).toBe(null); expect(state["create"].error).toBe('operation-failed');
  } finally { disposePinia(pinia); }
});

it("update executes the real service and Pinia state", async () => {
  const pinia = createPinia();
  try { const service = createGTestRecipesService(fixture()); const state = defineGTestRecipesStore(service)(pinia);
    expect((await state["update"].execute({"id":"fixture","revision":1,"values":{"title":"fixture"}})).ok).toBe(true);
    expect(state["update"].data).toEqual({"record":{"id":"fixture","type":"test-recipe","title":"fixture"},"revision":1}); expect(state["update"].pending).toBe(false);
  } finally { disposePinia(pinia); }
});

it("update reports adapter failure without success", async () => {
  const pinia = createPinia();
  try { const port = fixture(); port["update"] = async () => { throw new Error('fixture'); };
    const state = defineGTestRecipesStore(createGTestRecipesService(port))(pinia);
    expect((await state["update"].execute({"id":"fixture","revision":1,"values":{"title":"fixture"}})).ok).toBe(false);
    expect(state["update"].data).toBe(null); expect(state["update"].error).toBe('operation-failed');
  } finally { disposePinia(pinia); }
});

it("delete executes the real service and Pinia state", async () => {
  const pinia = createPinia();
  try { const service = createGTestRecipesService(fixture()); const state = defineGTestRecipesStore(service)(pinia);
    expect((await state["delete"].execute({"id":"fixture","revision":1})).ok).toBe(true);
    expect(state["delete"].data).toEqual(undefined); expect(state["delete"].pending).toBe(false);
  } finally { disposePinia(pinia); }
});

it("delete reports adapter failure without success", async () => {
  const pinia = createPinia();
  try { const port = fixture(); port["delete"] = async () => { throw new Error('fixture'); };
    const state = defineGTestRecipesStore(createGTestRecipesService(port))(pinia);
    expect((await state["delete"].execute({"id":"fixture","revision":1})).ok).toBe(false);
    expect(state["delete"].data).toBe(null); expect(state["delete"].error).toBe('operation-failed');
  } finally { disposePinia(pinia); }
});
