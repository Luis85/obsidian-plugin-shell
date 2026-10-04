import { it, expect } from 'vitest';
import { isGComponent } from "../../../src/generated/domain/entities/component.ts";
it("component validates its declared fields", () => { expect(isGComponent({"id":"fixture","type":"component","title":"fixture"})).toBe(true); expect(isGComponent(null)).toBe(false); expect(isGComponent({})).toBe(false); });
