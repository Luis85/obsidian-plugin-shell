import { it, expect } from 'vitest';
import { isGScreen } from "../../../src/generated/domain/entities/screen.ts";
it("screen validates its declared fields", () => { expect(isGScreen({"id":"fixture","type":"screen","title":"fixture"})).toBe(true); expect(isGScreen(null)).toBe(false); expect(isGScreen({})).toBe(false); });
