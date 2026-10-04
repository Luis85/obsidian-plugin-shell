import { it, expect } from 'vitest';
import { isGDataSource } from "../../../src/generated/domain/entities/data-source.ts";
it("data-source validates its declared fields", () => { expect(isGDataSource({"id":"fixture","type":"data-source","title":"fixture"})).toBe(true); expect(isGDataSource(null)).toBe(false); expect(isGDataSource({})).toBe(false); });
