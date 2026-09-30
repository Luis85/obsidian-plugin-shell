import {
  createFilePlan as createRuntimeFilePlan,
  applyFilePlan as applyRuntimeFilePlan,
} from './file-plan.mjs';

export type FilePlanEncoding = 'base64';
export type FilePlanStatus = 'unchanged' | 'create' | 'delete' | 'update';

export interface FilePlanEntry {
  path: string;
  content: string | null;
  encoding?: FilePlanEncoding;
}

export interface FilePlanChange extends FilePlanEntry {
  beforeHash: string | null;
  afterHash: string | null;
  status: FilePlanStatus;
}

export interface FilePlan {
  version: 1;
  root: string;
  changes: readonly Readonly<FilePlanChange>[];
}

export interface ApplyFilePlanReport {
  status: 'applied' | 'failed';
  written: string[];
  unchanged: string[];
  rolledBack: string[];
  preserved: string[];
  remaining: string[];
  recoveryPath?: string;
}

export interface ApplyFilePlanOptions {
  beforeWrite?: (change: Readonly<FilePlanChange>, index: number) => void | Promise<void>;
}

/**
 * Typed Stage-C facade over the unchanged safety-critical runtime.
 * The runtime still owns path validation, stale-preimage checks, locking and rollback.
 */
export async function createFilePlan(root: string, entries: readonly FilePlanEntry[]): Promise<FilePlan> {
  return await createRuntimeFilePlan(root, entries) as FilePlan;
}

export async function applyFilePlan(plan: FilePlan, options: ApplyFilePlanOptions = {}): Promise<ApplyFilePlanReport> {
  return await applyRuntimeFilePlan(plan, options) as ApplyFilePlanReport;
}
