import { it, expect } from 'vitest';
import { isGRequirement } from "../../../src/generated/domain/entities/requirement.ts";
it("requirement validates its declared fields", () => { expect(isGRequirement({"id":"fixture","type":"requirement","title":"fixture"})).toBe(true); expect(isGRequirement(null)).toBe(false); expect(isGRequirement({})).toBe(false); });
