import { it, expect } from 'vitest';
import { isGPluginProject } from "../../../src/generated/domain/entities/plugin-project.ts";
it("plugin-project validates its declared fields", () => { expect(isGPluginProject({"id":"fixture","type":"plugin-project","title":"fixture"})).toBe(true); expect(isGPluginProject(null)).toBe(false); expect(isGPluginProject({})).toBe(false); });
