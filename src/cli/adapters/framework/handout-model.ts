import { sha256 } from '#shared/platform/hash.ts';
import { handoutSections } from './handout-questions.ts';

export const HANDOUT_PATH = 'PROJECT-SETUP-HANDOUT.md';
const HANDOUT_VERSION = 1;
export const HANDOUT_LIMIT = 2_000_000;
const questionIndex = new Map(handoutSections.flatMap(section => section.questions.map(question => [question.id, question] as const)));
export const digest = (value: string | Buffer): string => sha256(value);
const templateHash = digest(JSON.stringify(handoutSections));
const metadataPattern = /^<!-- workbench-handout-snapshot: (.+) -->$/m;
const questionPattern = /^- \[([ xX])\] \*\*(REQUIRED|OPTIONAL)\*\* `([a-z][a-z0-9.-]+)` — (.+)$/;
const placeholder = /<(?:TBD|TODO|TBC|fill[^>]*)>|\b(?:TBD|TODO|TBC|unanswered)\b|^\s*(?:[-–—.?]+|N\/?A|none|pending)\s*$/i;
export interface SourceFile { path: string; sha256: string | null }
export interface HandoutSnapshot { schemaVersion: 1; templateHash: string; prdsRoot: string; prdsMode: 'configured' | 'explicit'; files: SourceFile[]; fingerprint: string }
export interface Suggestion { answer: string; evidence: string }
export interface HandoutAnswer { id: string; required: boolean; checked: boolean; answer: string; evidence: string }
export interface HandoutDiagnostic { code: string; message: string; id?: string }
export class HandoutError extends Error {
  code: string;
  constructor(code: string, message: string) { super(code + ': ' + message); this.name = 'HandoutError'; this.code = code; }
}
export function ensure(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) throw new HandoutError(code, message);
}
export function makeSnapshot(prdsRoot: string, files: SourceFile[], explicitPrds = false): HandoutSnapshot {
  const ordered = [...files].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const content = { schemaVersion: HANDOUT_VERSION, templateHash, prdsRoot, prdsMode: explicitPrds ? 'explicit' : 'configured', files: ordered } as const;
  return { ...content, fingerprint: digest(JSON.stringify(content)) };
}
function metadata(snapshot: HandoutSnapshot): string {
  return '<!-- workbench-handout-snapshot: ' + JSON.stringify(snapshot).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e') + ' -->';
}
function singleLine(value: string): string {
  // oxlint-disable-next-line no-control-regex
  return value.replace(/[\r\n\u0000-\u001f]+/g, ' ').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('`', '&#96;').trim();
}
export function renderHandout(snapshot: HandoutSnapshot, suggestions: Record<string, Suggestion> = {}): string {
  const lines = [
    '---', 'type: project-setup-handout', 'schemaVersion: 1', 'tool: Workbench', '---', '',
    '# Project setup handout', '',
    '**Purpose:** turn the given PRDs and a product-trio discussion into an explicit, bounded brief for the first bespoke prototype.', '',
    'This file belongs at the project root: `PROJECT-SETUP-HANDOUT.md`. It is a meeting workbook and an AI-agent handoff, not an executable script or a production-readiness certificate.', '',
    '**Fast path:** reuse existing PRD answers by linking their exact paths and headings. Complete and review the **REQUIRED** items; leave irrelevant **OPTIONAL** items unchecked. Keep the first prototype to one coherent end-to-end journey.', '',
    '**How to answer:** replace `<TBD>` with a concrete answer or an exact reference. Keep the stable question ID and the `Answer:` / `Evidence:` labels. Record evidence as a PRD path/heading, an observed configuration path, or a named trio decision. Then change `[ ]` to `[x]` only after review. An explicit exclusion needs a reason; a bare “N/A” does not close a required decision.', '',
    '**Generated suggestions are not decisions:** every new checkbox is unchecked, including suggested defaults and observed settings. No project-specific solution is invented from missing inputs. Add indented continuation lines or links to detailed typed Markdown instead of rewriting the PRDs.', '',
    '**Readiness:** the validator reports missing answers, stale sources and structural problems. A technically complete handout still needs the trio’s product/design/engineering judgment. `ready` never means permission to install, run commands, serve files, activate a plugin, publish, or use a personal vault.', '',
    '**Source snapshot:** the machine-readable comment below stores only project-relative file paths and hashes, not PRD contents or credentials. Do not edit it to bypass freshness checks. After changing inputs, use the explicit refresh operation, which preserves answers and notes and resets review checkboxes.', '',
    '**Agent interface:** first discover the installed capabilities with `node bin/app capabilities --json`. With the handout capability installed, use `node bin/app handout validate --json` for readiness and `node bin/app handout inspect --json` for structured answers. A blocked result stops setup execution, not the trio discussion.', '',
    ...(snapshot.files.some(file => file.path.toLowerCase().endsWith('.md') && file.sha256 !== null) ? [] : ['**Draft template:** no PRD files were available when this copy was generated. Add the given PRDs, refresh the source snapshot, and review the answers before using it as an agent execution brief.', '']),
    metadata(snapshot), '',
  ];
  for (const section of handoutSections) {
    lines.push('## ' + section.title, '', section.description, '');
    for (const question of section.questions) {
      const suggested = suggestions[question.id];
      const answer = suggested ? singleLine(suggested.answer) : question.default;
      lines.push(`- [ ] **${question.required ? 'REQUIRED' : 'OPTIONAL'}** \`${question.id}\` — ${question.question}`);
      lines.push(`  - Answer: ${answer}`);
      lines.push(`  - Evidence: ${suggested ? singleLine(suggested.evidence) : '<TBD: source or trio decision>'}`);
      lines.push(`  - Guidance: ${question.hint}`, '');
    }
  }
  return lines.join('\n') + '\n';
}
export function readSnapshot(text: string): HandoutSnapshot {
  ensure(Buffer.byteLength(text, 'utf8') <= HANDOUT_LIMIT, 'HANDOUT_TOO_LARGE', 'Handout exceeds its size limit.');
  const matches = [...text.matchAll(/^<!-- workbench-handout-snapshot: (.+) -->$/gm)];
  ensure(matches.length === 1, 'HANDOUT_METADATA', 'Expected one generated source snapshot; preserve the original handout.');
  let value: HandoutSnapshot;
  try { value = JSON.parse(matches[0]![1]!); } catch { throw new HandoutError('HANDOUT_METADATA', 'Invalid source-snapshot JSON.'); }
  ensure(value && value.schemaVersion === HANDOUT_VERSION && value.templateHash === templateHash, 'HANDOUT_VERSION', 'Unsupported handout version or questionnaire; an explicit migration is required.');
  ensure(typeof value.prdsRoot === 'string' && ['configured', 'explicit'].includes(value.prdsMode) && Array.isArray(value.files) && value.files.length <= 502, 'HANDOUT_METADATA', 'Invalid source inventory.');
  ensure(value.files.every(file => file && Object.keys(file).length === 2 && typeof file.path === 'string' && (file.sha256 === null || /^[a-f0-9]{64}$/.test(file.sha256))), 'HANDOUT_METADATA', 'Invalid source-file record.');
  ensure(new Set(value.files.map(file => file.path)).size === value.files.length, 'HANDOUT_METADATA', 'Duplicate source-file record.');
  ensure(Object.keys(value).sort().join(',') === 'files,fingerprint,prdsMode,prdsRoot,schemaVersion,templateHash', 'HANDOUT_METADATA', 'Unknown source-snapshot field.');
  ensure(makeSnapshot(value.prdsRoot, value.files, value.prdsMode === 'explicit').fingerprint === value.fingerprint, 'HANDOUT_METADATA', 'Source-snapshot fingerprint does not match its inventory.');
  return value;
}
type Fence = { character: string; length: number } | undefined;
/** Tracks fenced code blocks: returns whether the line is a fence marker and the fence state after it. */
function fenceStep(line: string, fence: Fence): { marker: boolean; fence: Fence } {
  const block = line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
  if (!block) return { marker: false, fence };
  const character = block[1]![0]!, length = block[1]!.length;
  if (!fence) return { marker: true, fence: { character, length } };
  const closes = fence.character === character && length >= fence.length && block[2]!.trim() === '';
  return { marker: true, fence: closes ? undefined : fence };
}
interface ParseState {
  answers: HandoutAnswer[]; diagnostics: HandoutDiagnostic[]; seen: Set<string>; seenFields: Set<string>;
  active?: HandoutAnswer; field?: 'answer' | 'evidence';
}
function startQuestion(state: ParseState, match: RegExpMatchArray): void {
  const id = match[3]!, definition = questionIndex.get(id);
  state.active = undefined; state.field = undefined;
  if (!definition) { state.diagnostics.push({ code: 'HANDOUT_UNKNOWN_ID', id, message: 'Unknown checklist ID.' }); return; }
  if (state.seen.has(id)) { state.diagnostics.push({ code: 'HANDOUT_DUPLICATE_ID', id, message: 'Duplicate checklist ID.' }); return; }
  state.seen.add(id);
  if ((match[2] === 'REQUIRED') !== definition.required) state.diagnostics.push({ code: 'HANDOUT_REQUIREMENT_CHANGED', id, message: 'Required/optional classification was changed.' });
  state.active = { id, required: definition.required, checked: match[1]!.toLowerCase() === 'x', answer: '', evidence: '' };
  state.seenFields = new Set<string>();
  state.answers.push(state.active);
}
/** Answer/Evidence fields and their indented continuation lines belong to the active checklist item. */
function fieldLine(state: ParseState, active: HandoutAnswer, line: string): void {
  const entry = line.match(/^  - (Answer|Evidence):\s*(.*)$/);
  if (entry) {
    const field = entry[1] === 'Answer' ? 'answer' : 'evidence';
    if (state.seenFields.has(field)) state.diagnostics.push({ code: 'HANDOUT_DUPLICATE_FIELD', id: active.id, message: `Repeated ${entry[1]} field.` });
    state.seenFields.add(field); state.field = field;
    active[field] = entry[2]!.trim(); return;
  }
  if (line.startsWith('  - Guidance:')) { state.field = undefined; return; }
  if (state.field && /^\s{4,}\S/.test(line)) active[state.field] += '\n' + line.trim();
}
function contentLine(state: ParseState, line: string): void {
  const match = line.match(questionPattern);
  if (match) { startQuestion(state, match); return; }
  if (line.startsWith('## ') || /^- \[[^\]]*\]/.test(line)) { state.active = undefined; state.field = undefined; }
  if (state.active) fieldLine(state, state.active, line);
}
export function parseAnswers(text: string): { answers: HandoutAnswer[]; diagnostics: HandoutDiagnostic[] } {
  ensure(Buffer.byteLength(text, 'utf8') <= HANDOUT_LIMIT, 'HANDOUT_TOO_LARGE', 'Handout exceeds its size limit.');
  const state: ParseState = { answers: [], diagnostics: [], seen: new Set<string>(), seenFields: new Set<string>() };
  let fence: Fence;
  for (const line of text.split(/\r?\n/)) {
    const step = fenceStep(line, fence);
    fence = step.fence;
    if (!step.marker && !fence) contentLine(state, line);
  }
  if (fence) state.diagnostics.push({ code: 'HANDOUT_FENCE', message: 'Unclosed fenced code block; remaining checklist cannot be validated.' });
  for (const id of questionIndex.keys()) if (!state.seen.has(id)) state.diagnostics.push({ code: 'HANDOUT_MISSING_ID', id, message: 'Expected checklist item is missing or malformed.' });
  return { answers: state.answers, diagnostics: state.diagnostics };
}
function completed(answer: HandoutAnswer): boolean {
  return answer.checked && answer.answer.trim().length > 0 && answer.evidence.trim().length > 0 && !placeholder.test(answer.answer) && !placeholder.test(answer.evidence);
}
function snapshotDiagnostics(text: string, current: HandoutSnapshot): HandoutDiagnostic[] {
  const diagnostics: HandoutDiagnostic[] = [];
  let saved: HandoutSnapshot | undefined;
  try { saved = readSnapshot(text); } catch (error) {
    diagnostics.push({ code: error instanceof HandoutError ? error.code : 'HANDOUT_METADATA', message: error instanceof Error ? error.message : 'Invalid snapshot.' });
  }
  if (saved && saved.fingerprint !== current.fingerprint) diagnostics.push({ code: 'HANDOUT_SOURCES_STALE', message: 'Source files/settings changed, were added or removed. Refresh the source snapshot and re-review the retained answers.' });
  if (!current.files.some(file => file.path.toLowerCase().endsWith('.md') && file.sha256 !== null)) diagnostics.push({ code: 'HANDOUT_PRDS_MISSING', message: 'No PRD Markdown files found. Provide the given PRDs in the configured PRD folder.' });
  return diagnostics;
}
function openAnswerDiagnostics(answers: HandoutAnswer[]): HandoutDiagnostic[] {
  return [
    ...answers.filter(answer => answer.required && !completed(answer)).map(answer => ({ code: 'HANDOUT_REQUIRED_OPEN', id: answer.id, message: 'Review this required item and provide a concrete Answer and Evidence.' })),
    ...answers.filter(answer => !answer.required && answer.checked && !completed(answer)).map(answer => ({ code: 'HANDOUT_OPTIONAL_OPEN', id: answer.id, message: 'A selected optional item also needs a concrete Answer and Evidence; otherwise leave it unchecked.' })),
  ];
}
/** An approval reads `approved; reviewer=<name>; date=YYYY-MM-DD` with a real calendar date. */
function approved(answer: HandoutAnswer | undefined): boolean {
  const approval = answer?.answer.match(/^approved;\s*reviewer=([^;]+);\s*date=(\d{4}-\d{2}-\d{2})(?:;.*)?$/i);
  if (!approval || !approval[1]!.trim()) return false;
  const date = new Date(approval[2]! + 'T00:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === approval[2];
}
function approvalDiagnostics(answers: HandoutAnswer[]): HandoutDiagnostic[] {
  return ['ready.product', 'ready.design', 'ready.engineering'].filter(id => !approved(answers.find(item => item.id === id)))
    .map(id => ({ code: 'HANDOUT_APPROVAL_OPEN', id, message: 'Record explicit approval as: approved; reviewer=<name or role>; date=YYYY-MM-DD; limitations=<details>. A rejection is blocking.' }));
}
function runModeDiagnostics(answers: HandoutAnswer[]): HandoutDiagnostic[] {
  const mode = answers.find(answer => answer.id === 'run.mode')?.answer.trim().toLowerCase();
  if (mode === undefined) return [];
  if (!['skip', 'verify', 'showcase'].includes(mode)) return [{ code: 'HANDOUT_RUN_MODE', id: 'run.mode', message: 'Choose exactly skip, verify or showcase.' }];
  const showcase = answers.find(answer => answer.id === 'run.showcase');
  if (mode !== 'showcase' || (showcase && completed(showcase))) return [];
  return [{ code: 'HANDOUT_SHOWCASE_OPEN', id: 'run.showcase', message: 'Showcase requires its local preview and shutdown behavior to be reviewed.' }];
}
export function validateHandout(text: string, current: HandoutSnapshot) {
  const parsed = parseAnswers(text);
  const diagnostics = [...parsed.diagnostics, ...snapshotDiagnostics(text, current), ...openAnswerDiagnostics(parsed.answers),
    ...approvalDiagnostics(parsed.answers), ...runModeDiagnostics(parsed.answers)];
  return {
    schemaVersion: HANDOUT_VERSION, ready: diagnostics.length === 0, executionAuthorized: false,
    sourceFingerprint: current.fingerprint, requiredTotal: [...questionIndex.values()].filter(question => question.required).length,
    requiredAnswered: parsed.answers.filter(answer => answer.required && completed(answer)).length,
    optionalAnswered: parsed.answers.filter(answer => !answer.required && completed(answer)).length,
    diagnostics, answers: parsed.answers,
  };
}
/** Preserve every answer and free-form note. Refresh is an explicit edit, never an implicit overwrite. */
export function refreshHandout(text: string, current: HandoutSnapshot): string {
  const previous = readSnapshot(text);
  const parsed = parseAnswers(text);
  ensure(parsed.diagnostics.length === 0, 'HANDOUT_STRUCTURE', 'Repair malformed checklist structure before refreshing; original text is preserved.');
  if (previous.fingerprint === current.fingerprint) return text;
  let fence: Fence;
  return text.replace(metadataPattern, () => metadata(current)).split(/(?<=\n)/).map(chunk => {
    const line = chunk.replace(/\r?\n$/, '');
    const step = fenceStep(line, fence);
    fence = step.fence;
    if (step.marker) return chunk;
    return !fence && questionPattern.test(line) ? chunk.replace(/^- \[[xX]\]/, '- [ ]') : chunk;
  }).join('');
}
