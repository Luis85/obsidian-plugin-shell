import { it, expect } from 'vitest';
import { isGSourceOperation } from "../../../src/generated/domain/entities/source-operation.ts";
it("source-operation validates its declared fields", () => { expect(isGSourceOperation({"id":"fixture","type":"source-operation","title":"fixture"})).toBe(true); expect(isGSourceOperation(null)).toBe(false); expect(isGSourceOperation({})).toBe(false); });
