import { it, expect } from 'vitest';
import { isGEntityDefinition } from "../../../src/generated/domain/entities/entity-definition.ts";
it("entity-definition validates its declared fields", () => { expect(isGEntityDefinition({"id":"fixture","type":"entity-definition","title":"fixture"})).toBe(true); expect(isGEntityDefinition(null)).toBe(false); expect(isGEntityDefinition({})).toBe(false); });
