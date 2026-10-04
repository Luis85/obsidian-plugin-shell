import { it, expect } from 'vitest';
import { isGDesignToken } from "../../../src/generated/domain/entities/design-token.ts";
it("design-token validates its declared fields", () => { expect(isGDesignToken({"id":"fixture","type":"design-token","title":"fixture"})).toBe(true); expect(isGDesignToken(null)).toBe(false); expect(isGDesignToken({})).toBe(false); });
