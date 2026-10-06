/**
 * Increment and PullRequest documents: the shared vocabulary of `node bin/app increment …` and `pr …`.
 * An Increment is the Definition of Ready handoff (configs/delivery/delivery.json); a PullRequest is the
 * plan of one pull request that delivers part of it. Both are frontmatter+Markdown files in a configured folder.
 */
import { hasControls } from '../errors.ts';
import { insistDelivery, type DeliveryErrorCode } from './errors.ts';

export const incrementStatuses = ['New', 'Refining', 'Ready', 'In progress', 'Done', 'Cancelled'] as const;
export type IncrementStatus = typeof incrementStatuses[number];
export const pullRequestStatuses = ['New', 'Draft', 'Ready', 'Merged', 'Closed'] as const;
export type PullRequestStatus = typeof pullRequestStatuses[number];
const e2eDecisions = ['none', 'optional', 'required'] as const;
export const issueStatuses = ['New', 'Ready', 'In progress', 'Done', 'Cancelled'] as const;
export type IssueStatus = typeof issueStatuses[number];
/** The kick-off pull request merges the increment branch into the base; change pull requests stack on the increment branch. */
export const pullRequestKinds = ['kickoff', 'change'] as const;
export type PullRequestKind = typeof pullRequestKinds[number];
export const publishingPlatforms = ['github', 'azure-devops'] as const;
export type HostingPlatform = typeof publishingPlatforms[number];
/** Frontmatter values in the DoR subset: a scalar string or a `[a, b]` list. */
export type FrontmatterValue = string | string[];
export type FrontmatterData = Record<string, FrontmatterValue>;

export interface SizeBudget { maxAcceptanceCriteria: number; maxAffectedAreas: number }
/** Branch patterns: `{id}` is the increment id, `{increment}` and `{pr}` name a change pull request's branch. */
export interface BranchConfig { increment: string; pullRequest: string; base: string }
/** The subset of delivery.json the documents depend on; built-in defaults mirror the committed file. */
export interface DeliverySchema {
  handoff: {
    glob: string; ignore: string[]; template: string; slugPattern: string; maxSlugLength: number; bodyKey: string;
    type: string; statuses: string[]; e2e: string[]; requiredKeys: string[]; optionalKeys: string[];
    sections: string[]; generatedSection: string;
  };
  pullRequests: { glob: string; type: string; incrementKey: string };
  sizes: Record<string, SizeBudget>;
  branches: BranchConfig;
  /** Where generated acceptance test stubs live: `{increment}` is the increment id, `{ac}` the lower-case criterion id. */
  acceptance: { pattern: string };
}
/** Increment keys the CLI writes beyond the original DoR set; delivery.json must list them in handoff.optionalKeys. */
export const incrementExtensionKeys = ['branch', 'base', 'issues'] as const;
export const defaultDeliverySchema: DeliverySchema = Object.freeze({
  handoff: {
    glob: 'docs/increments/*.md', ignore: ['docs/increments/README.md'], template: 'configs/delivery/increment-handoff.template.md',
    slugPattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$', maxSlugLength: 64, bodyKey: 'Handoff', type: 'Increment',
    statuses: [...incrementStatuses], e2e: [...e2eDecisions],
    requiredKeys: ['type', 'id', 'title', 'owner', 'size', 'status', 'e2e'], optionalKeys: ['refs', 'pullRequests', ...incrementExtensionKeys],
    sections: ['Summary', 'Outcome', 'Scope', 'Acceptance criteria', 'Affected areas', 'Test plan', 'Docs impact', 'Changelog', 'Risks and rollback', 'Dependencies', 'Open questions'],
    generatedSection: 'Completion record',
  },
  pullRequests: { glob: 'docs/pull-requests/*.md', type: 'PullRequest', incrementKey: 'increment' },
  sizes: { S: { maxAcceptanceCriteria: 5, maxAffectedAreas: 8 }, M: { maxAcceptanceCriteria: 10, maxAffectedAreas: 20 }, L: { maxAcceptanceCriteria: 20, maxAffectedAreas: 45 } },
  // Not increment/{increment}/{pr}: a repository cannot hold refs/heads/increment/x and refs/heads/increment/x/y at once.
  branches: { increment: 'increment/{id}', pullRequest: 'pr/{increment}/{pr}', base: 'main' },
  acceptance: { pattern: 'tests/acceptance/{increment}/{ac}.checks.mjs' },
});
/** Sections of a PullRequest document, in order; Scope holds `### In scope` and `### Out of scope`. */
export const pullRequestSections = ['Summary', 'Scope', 'Tasks', 'Documents', 'Notes', 'Amendments'] as const;
/** Body regions a sync compares as whole texts; tasks and amendments are compared per item. */
export const pullRequestRegions = ['summary', 'scope', 'documents', 'notes'] as const;
export type PullRequestRegion = typeof pullRequestRegions[number];
/** The CLI-owned Increment section and its generated marked region. */
export const pullRequestsSection = 'Pull requests';
export const pullRequestsRegion = 'pull-requests';
export const issuesSection = 'Issues';
export const issuesRegion = 'issues';
/** Sections of an Issue document, in order. */
export const issueSections = ['Summary', 'Acceptance criteria', 'Notes'] as const;
export const scopeSubsections = { in: 'In scope', out: 'Out of scope' } as const;
export type ScopeSide = keyof typeof scopeSubsections;

export const limits = Object.freeze({ tasks: 200, amendments: 100, documents: 100, notes: 20_000, amendment: 10_000, title: 120, item: 2_000, fragment: 200_000, document: 1_000_000 });

export interface Problem { code: string; message: string; line?: number }
export interface AcceptanceCriterion { id: string; checked: boolean; text: string; evidence: string[]; line: number }
export interface Task { id: string; checked: boolean; text: string; line: number }
export interface Amendment { id: string; date: string; body: string; line: number }
export interface Scope { in: string[]; out: string[] }
export interface SectionSummary { name: string; line: number; words: number }
/** Remote facts recorded in the PullRequest frontmatter once it is published. */
export interface PullRequestBinding {
  platform: HostingPlatform; repository: string; number: number; url: string; publishedAt: string; lastSyncedAt: string;
}
export const bindingKeys = ['platform', 'repository', 'number', 'url', 'publishedAt', 'lastSyncedAt'] as const;

export interface IncrementModel {
  id: string; title: string; owner: string; size: string; status: string; e2e: string;
  refs: string[]; pullRequests: string[]; issues: string[]; branch: string | null; base: string | null; frontmatter: FrontmatterData;
  heading: string | null; sections: SectionSummary[]; acceptance: AcceptanceCriterion[]; scope: Scope;
}
export interface PullRequestModel {
  id: string; title: string; increment: string; status: string; delivers: string[];
  /** `change` when the key is absent: documents written before kinds existed stack like change pull requests. */
  kind: PullRequestKind; issues: string[];
  head: string | null; base: string | null; binding: PullRequestBinding | null; frontmatter: FrontmatterData;
  heading: string | null; sections: SectionSummary[];
  /** Section bodies with LF line endings, as written between the headings. */
  regions: Record<PullRequestRegion, string>;
  scope: Scope; tasks: Task[]; amendments: Amendment[]; documents: string[];
}
/** One row of the generated pull-request table in an Increment. */
export interface PullRequestRow { id: string; title: string; status: string; path: string; number?: number; url?: string }
/** One row of the generated issue list in an Increment. */
export interface IssueRow { id: string; title: string; status: string; path: string }
/** An acceptance criterion of an Issue: `AC-n` refers to the increment's criterion, `IC-n` is the issue's own. */
export interface IssueCriterion { id: string; checked: boolean; text: string; line: number }
export interface IssueModel {
  id: string; title: string; status: string; increment: string; pullRequests: string[]; frontmatter: FrontmatterData;
  heading: string | null; sections: SectionSummary[]; regions: { summary: string; notes: string }; acceptance: IssueCriterion[];
}

const isStringList = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string' && item.length > 0);
function sameList(actual: unknown, expected: readonly string[], name: string): string[] {
  insistDelivery(isStringList(actual) && actual.join('\n') === expected.join('\n'), 'DELIVERY_SCHEMA_UNSUPPORTED', `delivery.json ${name} must be ${expected.join(', ')}; the increment commands depend on that vocabulary.`);
  return [...actual];
}
function sameValue(actual: unknown, expected: string, name: string): string {
  insistDelivery(actual === expected, 'DELIVERY_SCHEMA_UNSUPPORTED', `delivery.json ${name} must be ${expected}; the increment commands depend on that vocabulary.`);
  return expected;
}
const record = (value: unknown, name: string): Record<string, unknown> => {
  insistDelivery(value !== null && typeof value === 'object' && !Array.isArray(value), 'DELIVERY_SCHEMA_UNSUPPORTED', `delivery.json ${name} must be an object.`);
  return value as Record<string, unknown>;
};
const nonEmpty = (value: unknown, name: string): string => {
  insistDelivery(typeof value === 'string' && value.length > 0, 'DELIVERY_SCHEMA_UNSUPPORTED', `delivery.json ${name} must be a non-empty string.`);
  return value;
};
function sizes(value: unknown): Record<string, SizeBudget> {
  const entries = Object.entries(record(value, 'sizes')).map(([size, raw]) => {
    const budget = record(raw, `sizes.${size}`);
    const numbers = [budget.maxAcceptanceCriteria, budget.maxAffectedAreas];
    insistDelivery(numbers.every(item => Number.isInteger(item) && (item as number) > 0), 'DELIVERY_SCHEMA_UNSUPPORTED', `delivery.json sizes.${size} needs positive budgets.`);
    return [size, { maxAcceptanceCriteria: numbers[0] as number, maxAffectedAreas: numbers[1] as number }] as const;
  });
  insistDelivery(entries.length > 0, 'DELIVERY_SCHEMA_UNSUPPORTED', 'delivery.json sizes must name at least one size.');
  return Object.fromEntries(entries);
}
/** `refs` and `pullRequests`, then any of the CLI's extension keys; a file without them refuses only when those keys are written. */
function optionalKeys(value: unknown): string[] {
  const allowed: readonly string[] = incrementExtensionKeys;
  insistDelivery(isStringList(value) && value[0] === 'refs' && value[1] === 'pullRequests' && value.slice(2).every(key => allowed.includes(key)),
    'DELIVERY_SCHEMA_UNSUPPORTED', `delivery.json handoff.optionalKeys must be refs, pullRequests and optionally ${allowed.join(', ')}.`);
  return [...value];
}
/** Branch patterns are optional in delivery.json; the defaults apply when the key is absent. */
/** The stub pattern: a string or `{ pattern }`; it must name both placeholders so every criterion gets its own file. */
function acceptanceConfig(value: unknown): { pattern: string } {
  if (value === undefined) return { ...defaultDeliverySchema.acceptance };
  const pattern = nonEmpty(typeof value === 'string' ? value : record(value, 'acceptance').pattern, 'acceptance.pattern');
  insistDelivery(pattern.includes('{increment}') && pattern.includes('{ac}'), 'DELIVERY_SCHEMA_UNSUPPORTED', 'delivery.json acceptance.pattern must contain {increment} and {ac}.');
  return { pattern };
}
/** The acceptance test stub of one criterion, e.g. `tests/acceptance/delivery/ac-1.checks.mjs`; the default `Evidence:` of a new criterion. */
export function acceptanceStubPath(config: { pattern: string } = defaultDeliverySchema.acceptance, incrementId: string, acceptanceId: string): string {
  insistDelivery(isDeliverySlug(incrementId) && /^AC-\d+$/.test(acceptanceId), 'INCREMENT_INPUT_INVALID', 'An acceptance stub needs an increment id and an AC-n id.');
  return config.pattern.replaceAll('{increment}', incrementId).replaceAll('{ac}', acceptanceId.toLowerCase());
}
function branchConfig(value: unknown): BranchConfig {
  if (value === undefined) return { ...defaultDeliverySchema.branches };
  const raw = record(value, 'branches');
  return { increment: nonEmpty(raw.increment, 'branches.increment'), pullRequest: nonEmpty(raw.pullRequest, 'branches.pullRequest'), base: nonEmpty(raw.base, 'branches.base') };
}
/**
 * The schema from a parsed delivery.json. Folders, template, slug rule and sizes may differ from the defaults;
 * statuses, keys and sections are the vocabulary the commands are built on, so a different value refuses.
 */
export function deliverySchemaFrom(raw: unknown): DeliverySchema {
  const data = record(raw, 'root'), handoff = record(data.handoff, 'handoff'), pullRequests = record(data.pullRequests, 'pullRequests');
  const base = defaultDeliverySchema.handoff;
  const maxSlugLength = handoff.maxSlugLength;
  insistDelivery(Number.isInteger(maxSlugLength) && (maxSlugLength as number) > 0, 'DELIVERY_SCHEMA_UNSUPPORTED', 'delivery.json handoff.maxSlugLength must be a positive integer.');
  insistDelivery(Array.isArray(handoff.ignore) && handoff.ignore.every(item => typeof item === 'string'), 'DELIVERY_SCHEMA_UNSUPPORTED', 'delivery.json handoff.ignore must be a list of strings.');
  return {
    handoff: {
      glob: nonEmpty(handoff.glob, 'handoff.glob'), ignore: [...handoff.ignore as string[]], template: nonEmpty(handoff.template, 'handoff.template'),
      slugPattern: nonEmpty(handoff.slugPattern, 'handoff.slugPattern'), maxSlugLength: maxSlugLength as number, bodyKey: nonEmpty(handoff.bodyKey, 'handoff.bodyKey'),
      type: sameValue(handoff.type, base.type, 'handoff.type'), statuses: sameList(handoff.statuses, base.statuses, 'handoff.statuses'),
      e2e: sameList(handoff.e2e, base.e2e, 'handoff.e2e'), requiredKeys: sameList(handoff.requiredKeys, base.requiredKeys, 'handoff.requiredKeys'),
      optionalKeys: optionalKeys(handoff.optionalKeys), sections: sameList(handoff.sections, base.sections, 'handoff.sections'),
      generatedSection: sameValue(handoff.generatedSection, base.generatedSection, 'handoff.generatedSection'),
    },
    pullRequests: { glob: nonEmpty(pullRequests.glob, 'pullRequests.glob'), type: sameValue(pullRequests.type, 'PullRequest', 'pullRequests.type'),
      incrementKey: sameValue(pullRequests.incrementKey, 'increment', 'pullRequests.incrementKey') },
    sizes: sizes(data.sizes), branches: branchConfig(data.branches), acceptance: acceptanceConfig(data.acceptance),
  };
}
/** Refuses writing an Increment key the configured DoR would reject as unknown (DOR-02). */
export function requireIncrementKey(schema: DeliverySchema, key: string): void {
  insistDelivery([...schema.handoff.requiredKeys, ...schema.handoff.optionalKeys].includes(key), 'DELIVERY_SCHEMA_UNSUPPORTED',
    `delivery.json handoff.optionalKeys does not list ${key}; add it before the CLI writes ${key} to an Increment.`, { key });
}
/** True when the id is a slug of the configured pattern and length; DOR-02 also requires id === file name. */
export function isDeliverySlug(value: string, schema: DeliverySchema = defaultDeliverySchema): boolean {
  return value.length <= schema.handoff.maxSlugLength && new RegExp(schema.handoff.slugPattern, 'u').test(value);
}
/** The one-level `*.md` glob the DoR scripts use for a configured folder. */
const folderGlob = (folder: string): string => `${folder}/*.md`;
/** Configured folders whose delivery.json glob points elsewhere; the DoR scripts would read a different folder. */
export function deliveryPathsDrift(schema: DeliverySchema, folders: { increments: string; pullRequests: string }): Problem[] {
  const pairs = [['handoff.glob', schema.handoff.glob, folders.increments], ['pullRequests.glob', schema.pullRequests.glob, folders.pullRequests]] as const;
  return pairs.filter(([, glob, folder]) => glob !== folderGlob(folder))
    .map(([key, glob, folder]) => ({ code: 'DELIVERY_PATHS_DRIFT', message: `delivery.json ${key} is ${glob} but the configured folder is ${folder}; migrate the settings or align ${key}.` }));
}
/** A single-line title of at most 120 characters, trimmed. */
export function requireTitle(value: string, code: DeliveryErrorCode = 'INCREMENT_INPUT_INVALID', name = 'title'): string {
  const text = value.trim();
  insistDelivery(text.length > 0 && text.length <= limits.title && !hasControls(text), code, `Enter a single-line ${name} of 1 to ${limits.title} characters.`);
  return text;
}
/** A single-line list item or value of bounded length. */
export function requireLine(value: string, name: string, code: DeliveryErrorCode = 'INCREMENT_INPUT_INVALID', limit: number = limits.item): string {
  const text = value.trim();
  insistDelivery(text.length > 0 && text.length <= limit && !hasControls(text), code, `Enter ${name} as one line of 1 to ${limit} characters.`);
  return text;
}

/** A folder move of the increments or pull-requests root. */
export interface FolderMove { from: string; to: string }
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function jsonValue(text: string): unknown {
  try { return JSON.parse(text); } catch { return insistDelivery(false, 'DELIVERY_SCHEMA_UNSUPPORTED', 'delivery.json is not valid JSON.'); }
}
/** Replaces the one occurrence of a JSON string token (optionally after `"key": `), keeping every other byte. */
function replaceToken(text: string, before: string, after: string, key?: string): string {
  const pattern = new RegExp(`(${key ? `"${key}"\\s*:\\s*` : ''})${escape(JSON.stringify(before))}`, 'g'), found = [...text.matchAll(pattern)];
  insistDelivery(found.length === 1, 'DELIVERY_PATHS_DRIFT', `delivery.json must contain ${JSON.stringify(before)} exactly once to be migrated.`);
  const match = found[0]!;
  return text.slice(0, match.index) + match[1] + JSON.stringify(after) + text.slice(match.index + match[0].length);
}
/**
 * Rewrites delivery.json for a settings migration: `handoff.glob`, `handoff.ignore` entries inside the moved
 * increments folder and `pullRequests.glob`. Only those string tokens change; a glob that does not match the
 * old folder refuses with DELIVERY_PATHS_DRIFT instead of guessing.
 */
export function retargetDeliveryConfig(text: string, moves: { increments?: FolderMove; pullRequests?: FolderMove }): string {
  const data = record(jsonValue(text), 'root'), handoff = record(data.handoff, 'handoff'), pullRequests = record(data.pullRequests, 'pullRequests');
  let next = text;
  const retarget = (glob: unknown, move: FolderMove, name: string) => {
    insistDelivery(glob === folderGlob(move.from), 'DELIVERY_PATHS_DRIFT', `delivery.json ${name} is ${String(glob)}, not ${folderGlob(move.from)}; align it before migrating.`);
    next = replaceToken(next, folderGlob(move.from), folderGlob(move.to), 'glob');
  };
  if (moves.increments) {
    const move = moves.increments;
    retarget(handoff.glob, move, 'handoff.glob');
    const ignored = Array.isArray(handoff.ignore) ? handoff.ignore.filter((item): item is string => typeof item === 'string' && item.startsWith(`${move.from}/`)) : [];
    for (const item of ignored) next = replaceToken(next, item, move.to + item.slice(move.from.length));
  }
  if (moves.pullRequests) retarget(pullRequests.glob, moves.pullRequests, 'pullRequests.glob');
  return next;
}
