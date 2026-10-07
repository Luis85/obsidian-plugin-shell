/** Versioned, data-only recipes. Hosts implement these primitives, never starter IDs. */
import type { ProjectGenerator } from './project-generator.ts';
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type InputValue = string | boolean | number;
export interface StarterInput {
  id: string; label: string; type: 'string' | 'boolean' | 'integer';
  required: boolean; default?: InputValue; choices?: InputValue[];
}
export interface StarterFile { path: string; content?: string; json?: Json }
export interface StarterStep { runner: 'npm' | 'node'; args: string[]; script?: string; cwd: string; timeout: number }
export interface StarterProcess { id: string; label: string; description: string; dependsOn: string[]; steps: StarterStep[] }
export interface StarterDefinition {
  schemaVersion: 1; $schema?: string; id: string; name: string; version: string;
  category: string; level: 'Foundation' | 'Everyday' | 'Advanced'; summary: string;
  outcome: string; includes: string[]; implementation: string[]; tags: string[];
  inputs: StarterInput[];
  // The companion and project compilers are generic primitives, not an ID-to-template registry.
  generator: { kind: 'files' } | { kind: 'companion'; document: Record<string, unknown> } | ProjectGenerator;
  files: StarterFile[]; processes: StarterProcess[]; firstRun: string[]; nextSteps: string[];
}
