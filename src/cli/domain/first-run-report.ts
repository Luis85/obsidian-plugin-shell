import { object, keys } from './data.ts';
import { requireSketch } from './errors.ts';
const states = ['running', 'passed', 'failed', 'cancelled'];
const validHash = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
function check(value: unknown, message = 'Invalid first-run result; original bytes are preserved.'): asserts value {
  requireSketch(value, 'FIRST_RUN_REPORT', message);
}
function identity(report: Record<string, unknown>): void {
  check(report.schemaVersion === 1 && report.producer === 'shell-first-run', 'Preserve the unknown/corrupt first-run report; choose another configured report path.');
  keys(report, ['schemaVersion', 'producer', 'planHash', 'app', 'status', 'startedAt', 'finishedAt', 'stages', 'preview', 'installed', 'built', 'lockAfter', 'manualAcceptance', 'externalEffects', 'automaticRetry']);
  check(validHash(report.planHash)); check(typeof report.app === 'string');
  check(states.includes(String(report.status))); check(typeof report.startedAt === 'string');
  check(report.finishedAt === null || typeof report.finishedAt === 'string');
  check(typeof report.installed === 'boolean'); check(typeof report.built === 'boolean');
  check(report.lockAfter === null || validHash(report.lockAfter));
}
function stages(input: unknown): void {
  check(Array.isArray(input) && input.length >= 4 && input.length <= 5, 'Invalid stage inventory.');
  for (const value of input) {
    const stage = object(value); keys(stage, ['id', 'status', 'durationMs', 'diagnostic']);
    check(['install', 'typecheck', 'test', 'build', 'showcase'].includes(String(stage.id)), 'Invalid recorded stage.');
    check(['not-run', ...states].includes(String(stage.status)), 'Invalid recorded stage.');
  }
}
function preview(input: unknown): void {
  if (input === null) return;
  const value = object(input); keys(value, ['url', 'ready', 'httpStatus', 'browser', 'stopped']);
  check(typeof value.url === 'string' && /^http:\/\/127\.0\.0\.1:\d+\/$/.test(value.url), 'Invalid recorded showcase.');
  check(typeof value.ready === 'boolean'); check(typeof value.stopped === 'boolean');
  check(value.httpStatus === null || value.httpStatus === 200);
  check(['not-requested', 'requested', 'failed'].includes(String(value.browser)));
}
export function readFirstRunReport(input: unknown): Record<string, unknown> {
  const report = object(input); identity(report); stages(report.stages); preview(report.preview);
  check(report.manualAcceptance === 'not-verified');
  check(report.externalEffects === 'preserved-not-rolled-back'); check(report.automaticRetry === false);
  return report;
}
