import { applyFilePlanRuntime, createFilePlanRuntime } from './file-plan-runtime.ts';
// Only the types callers use are re-exported; file-plan-types.ts keeps the full contract.
export type {
  ApplyFilePlanOptions,
  ApplyFilePlanReport,
  FilePlan,
  FilePlanEntry,
} from './file-plan-types.ts';
import type { ApplyFilePlanOptions, ApplyFilePlanReport, FilePlan, FilePlanEntry } from './file-plan-types.ts';

export async function createFilePlan(root: string, entries: readonly FilePlanEntry[]): Promise<FilePlan> {
  return createFilePlanRuntime(root, entries);
}

export async function applyFilePlan(plan: FilePlan, options: ApplyFilePlanOptions = {}): Promise<ApplyFilePlanReport> {
  return applyFilePlanRuntime(plan, options);
}
