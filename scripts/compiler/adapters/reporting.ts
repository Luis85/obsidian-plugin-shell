import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createFilePlan, applyFilePlan } from '../../shared/file-plan.ts';
import { portableArtifactPath } from '../domain/artifacts.ts';
import { CompilerError, diagnostic } from '../domain/diagnostics.ts';
import type { CompilerEvent, Phase, CompilerDiagnostic, Readiness } from '../domain/contracts.ts';

export interface RunSummary {
  compilerVersion: string;
  status: string;
  outputKind: string;
  fingerprint: string | null;
  artifacts: number;
  diagnostics: CompilerDiagnostic[];
  readiness: Readiness;
}
/** Telemetry is adapter-owned. Its clock and run identity never enter artifacts or fingerprints. */
export function createRecorder(debug = false) {
  const runId = randomUUID(), start = performance.now();
  const events: Array<CompilerEvent & { sequence: number; elapsedMs: number }> = [];
  const failures: Array<{ phase: Phase; name: string; message: string; stack?: string }> = [];
  return {
    runId,
    events,
    onEvent(event: CompilerEvent): void {
      if (events.length < 1000) events.push({ ...event, sequence: events.length + 1, elapsedMs: Math.round((performance.now() - start) * 1000) / 1000 });
    },
    onFailure(error: unknown, phase: Phase): void {
      if (!debug) return;
      const seen = new Set<unknown>();
      for (let value = error; value instanceof Error && !seen.has(value) && failures.length < 8; value = value.cause) {
        seen.add(value);
        failures.push({ phase, name: value.name, message: value.message.slice(0, 2000), stack: value.stack?.slice(0, 12_000) });
      }
    },
    report(summary: RunSummary) {
      return { schemaVersion: 1, runId, durationMs: Math.round(performance.now() - start), ...summary };
    },
    debugReport() { return { schemaVersion: 1, warning: 'Opt-in debug stacks can contain local paths or authored values. Review before sharing.', failures }; },
  };
}
/** Reports are explicit, new, contained files. No report can overwrite source or an earlier run. */
export async function writeReports(root: string, directory: string, recorder: ReturnType<typeof createRecorder>, summary: RunSummary, debug = false): Promise<string> {
  if (!portableArtifactPath(directory) || !(directory === 'reports/compiler' || directory.startsWith('reports/compiler/'))) {
    throw new CompilerError(diagnostic('COMPILER_REPORT_FAILED', 'emit', 'Report directory must be a portable relative path beneath reports/compiler.'));
  }
  const prefix = directory + '/' + recorder.runId;
  const files = [
    { path: prefix + '/summary.json', content: JSON.stringify(recorder.report(summary), null, 2) + '\n' },
    { path: prefix + '/diagnostics.json', content: JSON.stringify(summary.diagnostics, null, 2) + '\n' },
    { path: prefix + '/events.ndjson', content: recorder.events.map(value => JSON.stringify(value)).join('\n') + '\n' },
    ...(debug ? [{ path: prefix + '/debug.json', content: JSON.stringify(recorder.debugReport(), null, 2) + '\n' }] : []),
  ];
  const plan = await createFilePlan(root, files);
  if (plan.changes.some(change => change.beforeHash !== null)) throw new CompilerError(diagnostic('COMPILER_REPORT_FAILED', 'emit', 'Report destination already exists.'));
  await applyFilePlan(plan);
  return prefix;
}
/** Terminal-safe rendering. Model text is data, including control sequences. */
export function formatDiagnostics(values: readonly CompilerDiagnostic[]): string {
  const safe = (value: string) => value.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ');
  return values.map(value => `${value.severity.toUpperCase()} ${safe(value.code)} [${value.phase}]\n` +
    (value.source ? `${safe(value.source.file)} · ${safe(value.source.jsonPointer || '/')} (${value.source.document ?? 'input'})\n` : '') +
    safe(value.message) + '\n' + safe(value.help) + '\n').join('\n');
}
