import type { CompositionUI } from '../composition-contract.mjs';
export type Scalar = string | number | boolean | null;
export type VisualState = 'default' | 'loading' | 'empty' | 'error' | 'disabled';
export type ValueExpression = { kind: 'literal'; value: unknown } | { kind: 'prop'; name: string } | { kind: 'state'; nodeId: string } | { kind: 'source'; sourceId: string; operationId: string; field: string };
export type Mapping = { kind: 'none' } | { kind: 'event' } | { kind: 'value'; value: unknown } | { kind: 'draft'; nodeId: string } | { kind: 'prop'; name: string } | { kind: 'source'; sourceId: string; operationId: string; field: string } | { kind: 'object'; fields: Record<string, Mapping> };
export type VisualAction = { kind: 'emit'; event: string; payload: Mapping } | { kind: 'navigate'; surfaceId: string } | { kind: 'set-state'; state: VisualState } | { kind: 'toggle'; nodeId: string } | { kind: 'set-value'; nodeId: string; value: Scalar } | { kind: 'focus'; nodeId: string } | { kind: 'source'; sourceId: string; operationId: string; input: Mapping };
export interface Interaction { id: string; event: string; label: string; actions: VisualAction[]; notes: string; acceptance: string }
export interface LayoutRules { mode: 'stack' | 'row' | 'grid'; ui: CompositionUI }
interface Common { id: string; name?: string; visibleIn?: VisualState[]; a11y?: string; layout?: LayoutRules }
export type ElementNode = Common & { kind: 'element'; tag: string; attrs: Record<string, ValueExpression>; children: UiNode[]; events: Interaction[] };
export type TextNode = Common & { kind: 'text'; role: 'h1' | 'h2' | 'h3' | 'p' | 'span'; value: ValueExpression };
export type SlotNode = Common & { kind: 'slot'; name: string; fallback: UiNode[] };
export type ComponentRef = { kind: 'nuxt-ui'; entryId: string } | { kind: 'project'; componentId: string; revisionId?: string };
export type ComponentNode = Common & { kind: 'component'; ref: ComponentRef; props: Record<string, ValueExpression>; slots: Record<string, UiNode[]>; events: Interaction[]; variantId?: string; control?: { kind: string; required?: boolean; options?: { label: string; value: string }[]; maxBytes?: number } };
export interface Dependency { package: string; version: string; purpose: string }
export type ExternalNode = Common & { kind: 'external'; package: string; adapter: string; props: Record<string, ValueExpression>; events: Interaction[] };
export type UiNode = ElementNode | TextNode | SlotNode | ComponentNode | ExternalNode;
export interface Scenario { id: string; name: string; state: VisualState; width: 'wide' | 'narrow'; values: Record<string, unknown>; bindings: { sourceId: string; operationId: string; value: unknown }[]; recipe?: unknown }
export interface PropDefinition { name: string; type: 'string' | 'number' | 'boolean'; required: boolean; default?: Scalar; description?: string }
export interface SlotDefinition { name: string; required: boolean; description?: string }
export interface EmitDefinition { name: string; payloadType: 'void' | 'string' | 'number' | 'boolean' | 'unknown'; description?: string }
export interface Variant { id: string; name: string; values: Record<string, Scalar> }
export interface Contract { props: PropDefinition[]; slots: SlotDefinition[]; emits: EmitDefinition[]; variants: Variant[] }
export interface PageDefinition { id: string; ownerId: string; name: string; root: UiNode[]; scenarios: Scenario[]; notes: string }
export interface ComponentDefinition extends Contract { id: string; libraryId: string; exportName: string; description: string; template: UiNode[]; scenarios: Scenario[]; notes?: string; implementation?: { catalog: 'nuxt-ui'; entryId: string }; dependencies?: Dependency[] }
export interface LayoutDefinition { id: string; name: string; description: string; scope: 'page' | 'region'; category: string; root: UiNode[]; slots: SlotDefinition[]; sourcePageId?: string }
export interface ComponentRevision { id: string; componentId: string; version: string; contract: Contract; template: UiNode[]; designSystem?: unknown; dependencies?: Dependency[] }
export interface VisualDesigns { schema: 3; nextId: number; catalog: { id: 'nuxt-ui'; version: 1 }; pages: PageDefinition[]; components: ComponentDefinition[]; layouts: LayoutDefinition[]; revisions: ComponentRevision[] }
export type DefinitionRef = { kind: 'page' | 'component' | 'layout'; id: string };
export interface WalkAt { parent: UiNode | null; depth: number; list: UiNode[]; index: number }
export const VISUAL_SCHEMA: 3; export const VISUAL_CATALOG: { readonly id: 'nuxt-ui'; readonly version: 1 };
export const VISUAL_TAGS: readonly string[]; export const VISUAL_TEXT_ROLES: readonly string[]; export const VISUAL_STATES: readonly VisualState[];
export const VISUAL_PROP_TYPES: readonly string[]; export const VISUAL_PAYLOAD_TYPES: readonly string[]; export const VISUAL_LAYOUT_MODES: readonly string[]; export const VISUAL_DOM_EVENTS: readonly string[];
export const VISUAL_LIMITS: Readonly<Record<'nodes' | 'definitions' | 'depth' | 'composition' | 'layouts' | 'revisions' | 'interactions' | 'actions' | 'scenarios' | 'contract', number>>;
export const VISUAL_DEPENDENCY_LIMIT: number;
export function visualAssert(ok: unknown, message: string): asserts ok;
export function visualIsRef(value: unknown): value is string; export function visualIsText(value: unknown, max: number, required?: boolean): value is string;
export function visualIsLine(value: unknown, max: number): value is string; export function visualIsKey(value: unknown): value is string;
export function visualIsScalar(value: unknown): value is Scalar; export function visualIsPlain(value: unknown): value is Record<string, unknown>;
export function emptyVisualDesigns(): VisualDesigns; export function visualAllocate(store: VisualDesigns, prefix: string): string;
export function visualChildLists(node: UiNode): UiNode[][]; export function visualWalk(nodes: UiNode[], visit: (node: UiNode, at: WalkAt) => void, parent?: UiNode | null, depth?: number): void;
export function visualLocate(nodes: UiNode[], id: string): ({ node: UiNode } & WalkAt) | null; export function visualNodes(nodes: UiNode[]): UiNode[];
export function visualRoot(definition: PageDefinition | ComponentDefinition | LayoutDefinition | ComponentRevision): UiNode[];
export function visualDefinition(store: VisualDesigns, ref: DefinitionRef): PageDefinition | ComponentDefinition | LayoutDefinition | null;
export function visualLiteral(value: unknown): ValueExpression; export function visualLayoutRules(mode?: LayoutRules['mode'], ui?: CompositionUI): LayoutRules;
export function visualElement(id: string, tag: string, extra?: Partial<ElementNode>): ElementNode; export function visualText(id: string, value: Scalar, role?: TextNode['role'], extra?: Partial<TextNode>): TextNode;
export function visualSlot(id: string, name: string, extra?: Partial<SlotNode>): SlotNode; export function visualNuxt(id: string, entryId: string, props?: Record<string, ValueExpression>, extra?: Partial<ComponentNode>): ComponentNode;
export function visualProject(id: string, componentId: string, extra?: Partial<ComponentNode>): ComponentNode;
export function visualIsPackage(value: unknown): value is string; export function visualIsExactVersion(value: unknown): value is string;
export function visualExternal(id: string, packageName: string, adapter: string, extra?: Partial<ExternalNode>): ExternalNode;
