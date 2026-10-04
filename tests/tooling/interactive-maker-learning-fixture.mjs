/** Shared scratch projects for the learning path checks: a configs/ folder with forms, wizards, paths, content and docs. */
import { access, mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
/**
 * The release-candidate guide is delivered by the separate increment/candidate feature. Until that page exists, the
 * idea-to-prototype course's two release-candidate steps link it, and these are exactly the issues learn check reports.
 */
const releaseCandidatesGuide ='docs/development/RELEASE-CANDIDATES.md';
export async function shippedLearningIssues(repository) {
  try { await access(join(repository, releaseCandidatesGuide)); return []; }
  catch { return ['record-an-increment', 'add-to-the-release-candidate'].map(id =>
    `path idea-to-prototype-with-claude-design.${id}: broken documentation link [[docs/development/RELEASE-CANDIDATES]]: ${releaseCandidatesGuide} does not exist.`); }
}
export async function scratch(fn) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'learning-'));
  try { return await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}
export async function put(root, path, value) {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2));
}
export const step = (id, extra = {}) => ({ id, title: `Step ${id}`, goal: `Learn ${id}.`, ...extra });
export const learningPath = (id, steps, extra = {}) => ({ schemaVersion: 1, id, version: 1, title: `Course ${id}`, summary: 'Learn it.', skill: 'Skill', audience: 'Everyone', estimatedMinutes: 5, steps, ...extra });
const form = (id, fields, extra = {}) => ({ schemaVersion: 1, id, version: 1, title: `Form ${id}`, fields, ...extra });
export const wizard = (id, steps, extra = {}) => ({ schemaVersion: 1, id, version: 1, title: `Wizard ${id}`, steps, ...extra });
/** Writes definitions below `<root>/configs` and documentation below `<root>`. */
export async function project(root, { paths = {}, forms = {}, wizards = {}, content = {}, docs = {} } = {}) {
  for (const [id, value] of Object.entries(forms)) await put(root, `configs/forms/${id}.json`, value);
  for (const [id, value] of Object.entries(wizards)) await put(root, `configs/wizards/${id}.json`, value);
  for (const [id, value] of Object.entries(paths)) await put(root, `configs/learning/paths/${id}.json`, value);
  for (const [file, value] of Object.entries(content)) await put(root, `configs/learning/content/${file}`, value);
  for (const [file, value] of Object.entries(docs)) await put(root, file, value);
  await mkdir(join(root, 'configs/forms'), { recursive: true });
  return join(root, 'configs');
}
export const contactForm = form('contact', [{ id: 'name', kind: 'title', label: 'Contact name' }]);
export const greetWizard = wizard('greet', [
  { id: 'ask', kind: 'form', form: 'contact', bind: 'contact' },
  { id: 'agree', kind: 'action', action: 'wizard.agree', with: { label: 'Finish?' } },
  { id: 'done', kind: 'end', text: 'Hello {{contact.name}}.' },
]);
/** Plain prompts answer strictly in order (a function line runs first, then answers); a missing line fails the check. */
export function plainPrompts(lines, back) {
  const questions = [], writes = [];
  return { questions, writes, left: () => lines.length, text: () => writes.join(''), ui: { write: value => writes.push(value), ask: async question => {
    questions.push(question);
    if (!lines.length) throw new Error('No scripted line left for: ' + question);
    const line = lines.shift(), value = typeof line === 'function' ? await line() : line;
    if (value === back) { const { Back } = await import('../../bin/presentation/prompts.ts'); throw new Back(); }
    return value;
  } } };
}
