import { it, expect } from 'vitest';
import { isGStorymap } from "../../../src/generated/domain/entities/storymap.ts";
it("storymap validates its declared fields", () => { expect(isGStorymap({"id":"fixture","type":"storymap","title":"fixture"})).toBe(true); expect(isGStorymap(null)).toBe(false); expect(isGStorymap({})).toBe(false); });
