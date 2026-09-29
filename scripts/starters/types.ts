/** Versioned, data-only recipes. Hosts implement these primitives, never starter IDs. */
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
  // The companion compiler is a generic primitive, not an ID-to-template registry.
  generator: { kind: 'files' } | { kind: 'companion'; document: Record<string, unknown> };
  files: StarterFile[]; processes: StarterProcess[]; firstRun: string[]; nextSteps: string[];
}
export interface LoadedStarter { definition: StarterDefinition; file: string; sha256: string; bytes: Buffer }
export interface StarterReceipt {
  schemaVersion: 1; starter: { id: string; name: string; version: string; sha256: string };
  values: Record<string, InputValue>; processes: StarterProcess[]; firstRun: string[]; nextSteps: string[];
  files: Array<{ path: string; sha256: string }>;
}
