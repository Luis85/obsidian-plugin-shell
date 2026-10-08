import type { FilePlan } from '../../../../scripts/shared/file-plan.ts';

export const flagOptions = ['--dry-run', '--yes', '--no-interaction', '--json', '--help', '--list', '--document', '--refresh', '--bare'] as const;
export const valueOptions = ['--feature', '--entity', '--folder', '--preset', '--backend', '--event', '--view', '--preference', '--extension', '--format', '--extensions', '--editor', '--file-type'] as const;
export type FlagOption = typeof flagOptions[number];
export type ValueOption = typeof valueOptions[number];
/** Parsed maker options: flags are `true`, value options carry their string. */
export type MakerOptions = { [Key in FlagOption]?: true } & { [Key in ValueOption]?: string };
export interface MakerArguments { readonly maker: string | undefined; readonly name: string | undefined; readonly options: MakerOptions }

export interface RegistryImport { readonly local: string; readonly from: string; readonly defaultImport?: boolean }
/** What every recipe, including a trusted local custom recipe, may use: declared outputs only, never direct writes. */
export interface RecipeContext {
  read(path: string): Promise<string>;
  add(path: string, content: string): Promise<void>;
  editArray(path: string, name: string, expression: string, imports?: readonly RegistryImport[]): Promise<void>;
  readonly tests: Set<string>;
}
export interface MakerContext extends RecipeContext {
  readonly root: string;
  edit(path: string, transform: (source: string) => string | Promise<string>): Promise<void>;
  finish(beforeFinalize?: () => unknown): Promise<FilePlan>;
}
export type Backend = 'domain' | 'markdown' | 'plugin-data';
export type Preset = 'title' | 'task' | 'project';
/** A validated request handed to one recipe handler. */
export interface MakerInput {
  readonly maker: string;
  readonly name: string;
  readonly options: MakerOptions;
  readonly owner: string | undefined;
  readonly entity: string | undefined;
  readonly folder: string;
  readonly preset: Preset;
  readonly backend: Backend;
}
/** A built-in recipe that composes a feature always has its owner and, for entity recipes, its entity. */
export interface OwnedInput extends MakerInput { readonly owner: string }
export interface EntityInput extends OwnedInput { readonly entity: string }
