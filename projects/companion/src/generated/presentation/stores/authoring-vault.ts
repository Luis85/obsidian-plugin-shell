import { defineStore } from 'pinia';
import { operation } from '../composables/operation.ts';
import type { GAuthoringVaultService } from '../../application/authoring-vault/service.ts';
export function defineGAuthoringVaultStore(service: GAuthoringVaultService) {
  return defineStore("workbench-companion:source:authoring-vault", () => ({
    "list-requirements": operation(service["list-requirements"],"read"),
    "list-sitemap": operation(service["list-sitemap"],"read"),
    "list-components": operation(service["list-components"],"read"),
  }));
}
