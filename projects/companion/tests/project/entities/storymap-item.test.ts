import { it, expect } from 'vitest';
import { isGStorymapItem } from "../../../src/generated/domain/entities/storymap-item.ts";
it("storymap-item validates its declared fields", () => { expect(isGStorymapItem({"id":"fixture","type":"storymap-item","title":"fixture"})).toBe(true); expect(isGStorymapItem(null)).toBe(false); expect(isGStorymapItem({})).toBe(false); });
