import { defineStore } from 'pinia';
import { operation } from '../composables/operation.ts';
import type { GTestRecipesService } from '../../application/test-recipes/service.ts';
export function defineGTestRecipesStore(service: GTestRecipesService) {
  return defineStore("workbench-companion:source:test-recipes", () => ({
    "list": operation(service["list"],"read"),
    "create": operation(service["create"],"write"),
    "update": operation(service["update"],"write"),
    "delete": operation(service["delete"],"write"),
  }));
}
