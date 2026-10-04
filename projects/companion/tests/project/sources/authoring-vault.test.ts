import { it, expect } from 'vitest';
import { createPinia, disposePinia } from 'pinia';
import { createGAuthoringVaultService } from "../../../src/generated/application/authoring-vault/service.ts";
import { defineGAuthoringVaultStore } from "../../../src/generated/presentation/stores/authoring-vault.ts";
import type { GAuthoringVaultPort } from "../../../src/generated/application/authoring-vault/contracts.ts";
const fixture = (): GAuthoringVaultPort => ({"list-requirements": async () => ([{"id":"fixture","type":"requirement","title":"fixture"}]),
"list-sitemap": async () => ([{"id":"fixture","type":"screen","title":"fixture"}]),
"list-components": async () => ([{"id":"fixture","type":"component","title":"fixture"}])});
it("list-requirements executes the real service and Pinia state", async () => {
  const pinia = createPinia();
  try { const service = createGAuthoringVaultService(fixture()); const state = defineGAuthoringVaultStore(service)(pinia);
    expect((await state["list-requirements"].execute(undefined)).ok).toBe(true);
    expect(state["list-requirements"].data).toEqual([{"id":"fixture","type":"requirement","title":"fixture"}]); expect(state["list-requirements"].pending).toBe(false);
  } finally { disposePinia(pinia); }
});

it("list-requirements reports adapter failure without success", async () => {
  const pinia = createPinia();
  try { const port = fixture(); port["list-requirements"] = async () => { throw new Error('fixture'); };
    const state = defineGAuthoringVaultStore(createGAuthoringVaultService(port))(pinia);
    expect((await state["list-requirements"].execute(undefined)).ok).toBe(false);
    expect(state["list-requirements"].data).toBe(null); expect(state["list-requirements"].error).toBe('operation-failed');
  } finally { disposePinia(pinia); }
});

it("list-sitemap executes the real service and Pinia state", async () => {
  const pinia = createPinia();
  try { const service = createGAuthoringVaultService(fixture()); const state = defineGAuthoringVaultStore(service)(pinia);
    expect((await state["list-sitemap"].execute(undefined)).ok).toBe(true);
    expect(state["list-sitemap"].data).toEqual([{"id":"fixture","type":"screen","title":"fixture"}]); expect(state["list-sitemap"].pending).toBe(false);
  } finally { disposePinia(pinia); }
});

it("list-sitemap reports adapter failure without success", async () => {
  const pinia = createPinia();
  try { const port = fixture(); port["list-sitemap"] = async () => { throw new Error('fixture'); };
    const state = defineGAuthoringVaultStore(createGAuthoringVaultService(port))(pinia);
    expect((await state["list-sitemap"].execute(undefined)).ok).toBe(false);
    expect(state["list-sitemap"].data).toBe(null); expect(state["list-sitemap"].error).toBe('operation-failed');
  } finally { disposePinia(pinia); }
});

it("list-components executes the real service and Pinia state", async () => {
  const pinia = createPinia();
  try { const service = createGAuthoringVaultService(fixture()); const state = defineGAuthoringVaultStore(service)(pinia);
    expect((await state["list-components"].execute(undefined)).ok).toBe(true);
    expect(state["list-components"].data).toEqual([{"id":"fixture","type":"component","title":"fixture"}]); expect(state["list-components"].pending).toBe(false);
  } finally { disposePinia(pinia); }
});

it("list-components reports adapter failure without success", async () => {
  const pinia = createPinia();
  try { const port = fixture(); port["list-components"] = async () => { throw new Error('fixture'); };
    const state = defineGAuthoringVaultStore(createGAuthoringVaultService(port))(pinia);
    expect((await state["list-components"].execute(undefined)).ok).toBe(false);
    expect(state["list-components"].data).toBe(null); expect(state["list-components"].error).toBe('operation-failed');
  } finally { disposePinia(pinia); }
});
