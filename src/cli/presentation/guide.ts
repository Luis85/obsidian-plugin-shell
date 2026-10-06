import { terminalInterview } from './guide-terminal.ts';
import { answer, visible, guideBrief, type Answers, type Answer, type Guide, type GuideField } from '../domain/guide.ts';
import { input, choose, confirm, reportError, Back, type Prompts } from './prompts.ts';
async function readAnswer(ui: Prompts, guide: Guide, field: GuideField, answers: Answers, fallback: Answer): Promise<unknown> {
  if (field.kind === 'confirm') {
    ui.write(guideBrief(guide, answers) + '\n');
    return confirm(ui, field.label);
  }
  if (field.kind === 'select') {
    return choose(ui, field.label, (field.choices ?? []).map(id => ({ id, label: id })), String(fallback));
  }
  const shown = Array.isArray(fallback) ? JSON.stringify(fallback) : String(fallback);
  const raw = await input(ui, `${field.label}${shown ? ` [${shown}]` : ''}`);
  if (!raw) return structuredClone(fallback);
  return field.kind === 'list' ? raw.split(';').map(item => item.trim()).filter(Boolean) : raw;
}
async function askField(ui: Prompts, guide: Guide, field: GuideField, answers: Answers, fallback: Answer): Promise<Answer> {
  while (true) {
    ui.write(field.help + '\n');
    try { return answer(field, await readAnswer(ui, guide, field, answers, fallback)); }
    catch (error) { if (error instanceof Back) throw error; reportError(ui, error); }
  }
}
/** No product-specific prompt branching: fields, visibility, defaults and readiness live in JSON. */
export async function interview(ui: Prompts, guide: Guide, initial: Answers = {}): Promise<Answers> {
  if (ui.rich) return terminalInterview({ ...ui, rich: ui.rich }, guide, initial);
  const answers: Answers = Object.create(null);
  for (const step of guide.steps) {
    ui.write(`\n${step.title}\n`);
    for (const field of step.fields) {
      if (visible(field.when, answers)) {
        answers[field.id] = await askField(ui, guide, field, answers, initial[field.id] ?? field.default);
      }
    }
  }
  return answers;
}
