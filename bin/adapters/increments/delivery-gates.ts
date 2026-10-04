/**
 * The Definition of Ready and Done from scripts/delivery, run in-process over the repository snapshot with an
 * explicit handoff. They load lazily (dependency-free scripts of the framework checkout); without them, or without
 * delivery.json or a commit to diff against, the Ready gate falls back to the domain's structural readiness and the
 * Done gate is unavailable (INCREMENT_GATES_UNAVAILABLE).
 */
import { join } from 'node:path';
import { exists } from '../framework/files.ts';
import { OperationError } from '../framework/contracts.ts';
import { readinessProblems } from '../../domain/increments/increment-document.ts';
import type { Problem } from '../../domain/increments/model.ts';
import type { DeliveryWorkspace } from './repository.ts';

export type Gate = 'ready' | 'done';
interface RuleResult { id: string; title: string; status: string; severity: string; message: string; hint?: string }
export interface GateReport { gate: string; status: string; handoff: string | null; base: { ref: string; sha: string } | null; rules: RuleResult[]; refinement?: unknown; generated: { files?: Record<string, string>; [key: string]: unknown } }
export interface Readiness { source: 'definition-of-ready' | 'structural'; problems: Problem[] }
/** Rules a single-document check ignores: DOR-01 selects the handoff from a pull-request diff, DOR-15 is the status itself. */
const transitionIgnored = ['DOR-01', 'DOR-15'];

/** The base to diff against: --base, else origin/main, main, then HEAD; null without any commit. */
async function gateBase(ws: DeliveryWorkspace, explicit?: string): Promise<string | null> {
  if (explicit) return explicit;
  const base = ws.schema.branches.base;
  for (const ref of [`origin/${base}`, base, 'HEAD']) if (await ws.git.resolve(ref)) return ref;
  return null;
}
async function available(ws: DeliveryWorkspace): Promise<boolean> {
  return ws.configured && await exists(join(ws.context.frameworkRoot, 'scripts/delivery/run.mjs')) && await ws.git.available();
}
/** Runs one gate without writing; null when the delivery scripts, configuration or a base commit are missing. */
export async function runGate(ws: DeliveryWorkspace, path: string, gate: Gate, explicitBase?: string): Promise<GateReport | null> {
  const base = await gateBase(ws, explicitBase);
  if (!base || !await available(ws)) return null;
  const [{ loadConfig }, { repositorySnapshot }, { runReady, runDone }, { readyRules }, { doneRules }] = await Promise.all([
    import('../../../scripts/delivery/config.mjs'), import('../../../scripts/delivery/repository.mjs'), import('../../../scripts/delivery/run.mjs'),
    import('../../../scripts/delivery/rules-ready.mjs'), import('../../../scripts/delivery/rules-done.mjs')]);
  const config = await loadConfig(ws.root, gate, gate === 'ready' ? readyRules : doneRules);
  if (gate === 'done') Object.assign(config, { ready: (await loadConfig(ws.root, 'ready', readyRules)).rules });
  const snapshot = repositorySnapshot(ws.root, base, { env: {} });
  const io = { write: () => undefined, refresh: () => snapshot, template: () => ws.template ?? '', gates: () => null };
  const options = { handoff: path, write: false };
  const report: GateReport = gate === 'ready' ? runReady(config, snapshot, options, io) : runDone(config, snapshot, options, io);
  return report;
}
/** Blocking failures of a report, optionally without the rules a single-document check ignores. */
export const blocking = (report: GateReport, ignored: readonly string[] = []): RuleResult[] =>
  report.rules.filter(rule => rule.status === 'fail' && rule.severity === 'error' && !ignored.includes(rule.id));
/** What blocks the Ready transition: the Definition of Ready without DOR-01/DOR-15, else structural readiness. */
export async function readiness(ws: DeliveryWorkspace, path: string, text: string): Promise<Readiness> {
  const report = await runGate(ws, path, 'ready').catch((error: unknown) => {
    if (error instanceof Error && 'code' in error && error.code === 'DELIVERY_BASE_UNRESOLVED') return null;
    throw error;
  });
  if (!report) return { source: 'structural', problems: readinessProblems(text, { schema: ws.schema, path, files: await ws.files() }) };
  return { source: 'definition-of-ready', problems: blocking(report, transitionIgnored).map(rule => ({ code: 'INCREMENT_NOT_READY', message: `${rule.id} ${rule.title}: ${rule.message}` })) };
}
/** The Done gate or a coded refusal when it cannot run. */
export async function requireGate(ws: DeliveryWorkspace, path: string, gate: Gate, base?: string): Promise<GateReport> {
  const report = await runGate(ws, path, gate, base);
  if (!report) throw new OperationError('INCREMENT_GATES_UNAVAILABLE', 'The Definition of Done needs configs/delivery/delivery.json, scripts/delivery and a git work tree with a commit to diff against.', 'npm run dod -- --handoff <path>');
  return report;
}
