export type Status = 'backlog' | 'ready' | 'doing' | 'blocked' | 'done';
export type Priority = 'high' | 'medium' | 'low';
export type Stage = 'planning' | 'active' | 'closed';
export type Confidence = 'unknown' | 'on-track' | 'at-risk' | 'off-track';
export type Outcome = 'not-assessed' | 'met' | 'partly-met' | 'not-met';
export type RetroCategory = 'keep' | 'change' | 'try';
export interface Backlog { id: string; title: string }
export interface Resource { id: string; name: string; role: string }
export interface Item {
  id: string; backlogId: string; title: string; description: string; type: string;
  priority: Priority; estimate: number | null; ownerId: string | null;
  status: Status; archived: boolean;
}
export interface Work {
  itemId: string; title: string; estimate: number | null; ownerId: string | null;
  status: Status; note: string; nextAction: string; blocker: string;
  doneCheck: boolean; releaseNote: string; addedAt: string;
}
export interface DailyNote { itemId: string; note: string; nextAction: string }
export interface Daily { date: string; notes: DailyNote[]; finished: boolean; summary: string }
export interface Retro {
  id: string; category: RetroCategory; text: string;
  ownerId: string | null; backlogItemId: string | null;
}
export interface Snapshot { date: string; delivered: Work[]; unfinished: Work[] }
export interface Iteration {
  id: string; index: number; goal: string; description: string; start: string; end: string;
  stage: Stage; confidence: Confidence;
  members: { resourceId: string; hours: number }[];
  references: { id: string; title: string; url: string }[];
  work: Work[]; baseline: Work[] | null;
  scopeChanges: { date: string; itemId: string; action: 'added' | 'removed'; reason: string }[];
  daily: Daily[];
  increment: { id: string; summary: string; reviewNotes: string; goalOutcome: Outcome; snapshot: Snapshot | null };
  retro: Retro[];
}
export interface Workspace {
  kind: 'iteration-planner.workspace'; schemaVersion: 1; productName: string;
  clock: string; nextId: number; nextIteration: number;
  backlogs: Backlog[]; items: Item[]; resources: Resource[]; iterations: Iteration[];
}
export const statuses: Status[] = ['backlog', 'ready', 'doing', 'blocked', 'done'];
export const priorities: Priority[] = ['high', 'medium', 'low'];
export const statusLabels: Record<Status, string> = {
  backlog: 'Backlog', ready: 'Ready', doing: 'In progress', blocked: 'Blocked', done: 'Done'
};
export function clone<T>(value: T): T { return structuredClone(value); }
export function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
export function required(value: string, label = 'Title', max = 180): string {
  const result = value.trim();
  ensure(result.length > 0 && result.length <= max, `${label} must contain 1–${max} characters.`);
  return result;
}
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function plusDays(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function mondayOnOrAfter(value: string): string {
  const day = new Date(`${value}T12:00:00Z`).getUTCDay();
  return plusDays(value, (8 - day) % 7);
}
export function workingDays(start: string, end: string): string[] {
  const days: string[] = [];
  for (let date = start; date <= end; date = plusDays(date, 1)) {
    const day = new Date(`${date}T12:00:00Z`).getUTCDay();
    if (day !== 0 && day !== 6) days.push(date);
  }
  return days;
}
export function getIteration(state: Workspace, id: string): Iteration {
  const value = state.iterations.find(iteration => iteration.id === id);
  ensure(value, 'This iteration no longer exists.');
  return value;
}
export function getItem(state: Workspace, id: string): Item {
  const value = state.items.find(item => item.id === id);
  ensure(value, 'This backlog item no longer exists.');
  return value;
}
export function nameOf(iteration: Iteration): string {
  return `Iteration — ${iteration.goal} — ${iteration.index}`;
}
export function assignment(state: Workspace, itemId: string): Iteration | undefined {
  return state.iterations.find(iteration => iteration.stage !== 'closed' && iteration.work.some(work => work.itemId === itemId));
}
export function summary(iteration: Iteration) {
  const snapshot = iteration.increment.snapshot;
  const work = snapshot ? [...snapshot.delivered, ...snapshot.unfinished] : iteration.work;
  const delivered = snapshot?.delivered ?? work.filter(item => item.status === 'done');
  const total = work.length;
  return {
    total, delivered, done: delivered.length,
    percent: total ? Math.round(delivered.length / total * 100) : 0,
    blocked: work.filter(item => item.status === 'blocked').length,
    doing: work.filter(item => item.status === 'doing').length,
    estimate: work.reduce((sum, item) => sum + (item.estimate ?? 0), 0),
    unestimated: work.filter(item => item.estimate === null).length,
    capacity: iteration.members.reduce((sum, member) => sum + member.hours, 0),
    baseline: iteration.baseline?.length ?? total
  };
}
export function safeUrl(value: string): boolean {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
}
export function exportChangelog(iteration: Iteration): string {
  const stats = summary(iteration);
  const left = iteration.increment.snapshot?.unfinished ?? iteration.work.filter(work => work.status !== 'done');
  return [
    `# ${nameOf(iteration)}`, '', `${iteration.start} → ${iteration.end}`, '',
    `Status: ${iteration.stage === 'closed' ? 'Reviewed' : 'Live draft'}; not a release.`, '',
    `## Increment (${stats.done} of ${stats.total} items done)`, '',
    iteration.increment.summary, '',
    ...(stats.delivered.length ? stats.delivered.map(work => `- ${work.title}: ${work.releaseNote}`) : ['No completed work met the Definition of Done in this iteration.']), '',
    '## Not delivered', '', ...left.map(work => `- ${work.title} (${statusLabels[work.status]}): ${work.note}`), '',
    `## Goal outcome: ${iteration.increment.goalOutcome}`, '', iteration.increment.reviewNotes, ''
  ].join('\n');
}
