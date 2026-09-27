namespace Jev {
  export type QuestionType = 'choice' | 'score' | 'noul';
  export interface Option { key: string; description: string }
  export interface Question {
    id: string; type: QuestionType; instructions: string;
    options: Option[]; levels: string[]; yes: string; no: string;
  }
  export interface Bindings {
    body: boolean; frontmatter: boolean; tasks: boolean; headings: boolean;
    selection: boolean; linkedNotes: boolean; maxChars: number; maxReferences: number;
    fields: string[]; excludedFolders: string[];
  }
  export interface Policy { confidence: number; yes: number; no: number }
  export interface Recipe {
    kind: 'jev-prompt'; schemaVersion: 1 | 2; id: string; name: string;
    description: string; tags: string[]; model: string;
    status: 'draft' | 'ready' | 'archived'; bindings: Bindings;
    questions: Question[]; policy: Policy; events?: LogicEvent[];
  }
  export interface Revision { id: string; createdAt: string; message: string; recipe: Recipe }
  export interface Library {
    kind: 'jev-prompt-library'; schemaVersion: 1 | 2;
    prompts: Recipe[]; revisions: Record<string, Revision[]>; logic?: LogicLibrary;
  }
  export interface Note {
    path: string; name: string; body: string; properties: Record<string, string | boolean | number | string[]>;
    tags: string[]; links: string[]; headings: string[]; tasks: { text: string; done: boolean }[];
    modifiedAt: number; synthetic: boolean;
  }
  export interface VaultState { name: string; notes: Note[]; activePath: string; references: string[]; selection: string; synthetic: boolean; importedAt: string; excluded: string[] }
  export interface Snapshot { state: Record<string, unknown>; warnings: string[]; included: string[]; characters: number; fingerprint: string }
  export interface RequestBody { model: string; state: Record<string, unknown>; questions: Record<string, Record<string, unknown>> }
  export interface Answer { type: QuestionType; choice?: string; score?: number; noul?: number; confidence?: number; probabilities?: Record<string, number>; legend?: Record<string, string> }
  export interface ResponseBody { model: string; answers: Record<string, Answer>; usage: { input_tokens: number; output_tokens: number } }
  export interface Decision { id: string; type: QuestionType; value: string; verdict: 'suggestion' | 'review' | 'invalid'; detail: string; confidence?: number; probabilities: { label: string; value: number }[] }
  export interface Check { path: string; message: string }
  export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
  export const safeKey = (value: string): boolean => /^[a-z][a-z0-9_]{0,47}$/.test(value) && !['__proto__','constructor','prototype'].includes(value);
  export function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
  export function same(a: unknown, b: unknown): boolean { return JSON.stringify(a) === JSON.stringify(b); }
  export function fingerprint(value: unknown): string {
    const text = JSON.stringify(value); let h = 2166136261;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16).padStart(8, '0'); // Display-only change ID; not a security hash.
  }
}
