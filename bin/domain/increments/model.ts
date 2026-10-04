/**
 * Increment and PullRequest documents: the shared vocabulary of `node bin/app increment …` and `pr …`.
 * An Increment is the Definition of Ready handoff (configs/delivery/delivery.json); a PullRequest is the
 * plan of one pull request that delivers part of it. Both are frontmatter+Markdown files in a configured folder.
 */
import { insistDelivery } from './errors.ts';

export const incrementStatuses = ['New', 'Refining', 'Ready', 'In progress', 'Done', 'Cancelled'] as const;
export type IncrementStatus = typeof incrementStatuses[number];
export const pullRequestStatuses = ['New', 'Draft', 'Ready', 'Merged', 'Closed'] as const;
export type PullRequestStatus = typeof pullRequestStatuses[number];
export const e2eDecisions = ['none', 'optional', 'required'] as const;
export type E2eDecision = typeof e2eDecisions[number];
export const hostingPlatforms = ['github', 'azure-devops'] as const;
export type HostingPlatform = typeof hostingPlatforms[number];
/** Frontmatter values in the DoR subset: a scalar string or a `[a, b]` list. */
export type FrontmatterValue = string | string[];
export type FrontmatterData = Record<string, FrontmatterValue>;

export interface SizeBudget { maxAcceptanceCriteria: number; maxAffectedAreas: number }
/** The subset of delivery.json the documents depend on; built-in defaults mirror the committed file. */
export interface DeliverySchema {
  handoff: {
    glob: string; ignore: string[]; template: string; slugPattern: string; maxSlugLength: number; bodyKey: string;
    type: string; statuses: string[]; e2e: string[]; requiredKeys: string[]; optionalKeys: string[];
    sections: string[]; generatedSection: string;
  };
  pullRequests: { glob: string; type: string; incrementKey: string };
  sizes: Record<string, SizeBudget>;
}
export const defaultDeliverySchema: DeliverySchema = Object.freeze({
  handoff: {
    glob: 'docs/increments/*.md', ignore: ['docs/increments/README.md'], template: 'configs/delivery/increment-handoff.template.md',
    slugPattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$', maxSlugLength: 64, bodyKey: 'Handoff', type: 'Increment',
    statuses: [...incrementStatuses], e2e: [...e2eDecisions],
    requiredKeys: ['type', 'id', 'title', 'owner', 'size', 'status', 'e2e'], optionalKeys: ['refs', 'pullRequests'],
    sections: ['Summary', 'Outcome', 'Scope', 'Acceptance criteria', 'Affected areas', 'Test plan', 'Docs impact', 'Changelog', 'Risks and rollback', 'Dependencies', 'Open questions'],
    generatedSection: 'Completion record',
  },
  pullRequests: { glob: 'docs/pull-requests/*.md', type: 'PullRequest', incrementKey: 'increment' },
  sizes: { S: { maxAcceptanceCriteria: 5, maxAffectedAreas: 8 }, M: { maxAcceptanceCriteria: 10, maxAffectedAreas: 20 }, L: { maxAcceptanceCriteria: 20, maxAffectedAreas: 45 } },
});
/** Sections of a PullRequest document, in order; Scope holds `### In scope` and `### Out of scope`. */
export const pullRequestSections = ['Summary', 'Scope', 'Tasks', 'Documents', 'Notes', 'Amendments'] as const;
export type PullRequestSection = typeof pullRequestSections[number];
/** Body regions a sync compares as whole texts; tasks and amendments are compared per item. */
export const pullRequestRegions = ['summary', 'scope', 'documents', 'notes'] as const;
export type PullRequestRegion = typeof pullRequestRegions[number];
/** The CLI-owned Increment section and its generated marked region. */
export const pullRequestsSection = 'Pull requests';
export const pullRequestsRegion = 'pull-requests';
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
  refs: string[]; pullRequests: string[]; frontmatter: FrontmatterData;
  heading: string | null; sections: SectionSummary[]; acceptance: AcceptanceCriterion[]; scope: Scope;
}
export interface PullRequestModel {
  id: string; title: string; increment: string; status: string; delivers: string[];
  head: string | null; base: string | null; binding: PullRequestBinding | null; frontmatter: FrontmatterData;
  heading: string | null; sections: SectionSummary[];
  /** Section bodies with LF line endings, as written between the headings. */
  regions: Record<PullRequestRegion, string>;
  scope: Scope; tasks: Task[]; amendments: Amendment[]; documents: string[];
}
/** One row of the generated pull-request table in an Increment. */
export interface PullRequestRow { id: string; title: string; status: string; path: string; number?: number; url?: string }

const isStringList = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string' && item.length > 0);
function sameList(actual: unknown, expected: readonly string[], name: string): string[] {
  insistDelivery(isStringList(actual) && actual.join('\n') === expected.join('\n'), 'DELIVERY_SCHEMA_UNSUPPORTED', `delivery.json ${name} must be ${expected.join(', ')}; the increment commands depend on that vocabulary.`);
  return [...actual];
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
      type: sameList([handoff.type], [base.type], 'handoff.type')[0]!, statuses: sameList(handoff.statuses, base.statuses, 'handoff.statuses'),
      e2e: sameList(handoff.e2e, base.e2e, 'handoff.e2e'), requiredKeys: sameList(handoff.requiredKeys, base.requiredKeys, 'handoff.requiredKeys'),
      optionalKeys: sameList(handoff.optionalKeys, base.optionalKeys, 'handoff.optionalKeys'), sections: sameList(handoff.sections, base.sections, 'handoff.sections'),
      generatedSection: sameList([handoff.generatedSection], [base.generatedSection], 'handoff.generatedSection')[0]!,
    },
    pullRequests: { glob: nonEmpty(pullRequests.glob, 'pullRequests.glob'), type: sameList([pullRequests.type], ['PullRequest'], 'pullRequests.type')[0]!,
      incrementKey: sameList([pullRequests.incrementKey], ['increment'], 'pullRequests.incrementKey')[0]! },
    sizes: sizes(data.sizes),
  };
}
/** True when the id is a slug of the configured pattern and length; DOR-02 also requires id === file name. */
export function isDeliverySlug(value: string, schema: DeliverySchema = defaultDeliverySchema): boolean {
  return value.length <= schema.handoff.maxSlugLength && new RegExp(schema.handoff.slugPattern, 'u').test(value);
}
/** The one-level `*.md` glob the DoR scripts use for a configured folder. */
export const folderGlob = (folder: string): string => `${folder}/*.md`;
/** Configured folders whose delivery.json glob points elsewhere; the DoR scripts would read a different folder. */
export function deliveryPathsDrift(schema: DeliverySchema, folders: { increments: string; pullRequests: string }): Problem[] {
  const pairs = [['handoff.glob', schema.handoff.glob, folders.increments], ['pullRequests.glob', schema.pullRequests.glob, folders.pullRequests]] as const;
  return pairs.filter(([, glob, folder]) => glob !== folderGlob(folder))
    .map(([key, glob, folder]) => ({ code: 'DELIVERY_PATHS_DRIFT', message: `delivery.json ${key} is ${glob} but the configured folder is ${folder}; migrate the settings or align ${key}.` }));
}
