import { it, expect } from 'vitest';
import { isGTestRecipe } from "../../../src/generated/domain/entities/test-recipe.ts";
it("test-recipe validates its declared fields", () => { expect(isGTestRecipe({"id":"fixture","type":"test-recipe","title":"fixture"})).toBe(true); expect(isGTestRecipe(null)).toBe(false); expect(isGTestRecipe({})).toBe(false); });
