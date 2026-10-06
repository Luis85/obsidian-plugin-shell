import { answer, visible, guideBrief, type Answers, type Answer, type Guide, type GuideField } from '../domain/guide.ts';
import { Back, type Prompts } from '#tui/prompts.ts';
import type { RichPrompts } from '#tui/engine/contracts.ts';
function defaultValue(field: GuideField, cache: Answers): Answer {
  return field.kind === 'confirm' ? false : cache[field.id] ?? field.default;
}
async function terminalField(ui: RichPrompts, guide: Guide, field: GuideField, answers: Answers, initial: Answer): Promise<Answer> {
  if (field.kind === 'confirm') {
    await ui.review('Review your prototype brief', [{ title: 'Complete brief', body: guideBrief(guide, answers) }]);
    return await ui.select(field.label, [{ id: 'no', label: 'No — not agreed yet' }, { id: 'yes', label: 'Yes — agree to this brief' }], 'no') === 'yes';
  }
  if (field.kind === 'select') return ui.select(field.label, (field.choices ?? []).map(id => ({ id, label: id })), String(initial));
  const convert = (value: string) => field.kind === 'list' ? value.split('\n').map(item => item.trim()).filter(Boolean) : value;
  const value = await ui.text({ title: field.label, initial: Array.isArray(initial) ? initial.join('\n') : String(initial),
    multiline: field.kind === 'list', help: field.kind === 'list' ? 'One item per line. Ctrl+J adds a line; Enter continues. Ctrl+U clears all.' : field.help,
    validate(text) {
      try { answer(field, convert(text)); return undefined; }
      catch (error) { return error instanceof Error ? error.message : 'Invalid answer.'; }
    } });
  return answer(field, convert(value));
}
/** Back revisits active fields; stale branch answers are dropped, and agreement is always renewed. */
export async function terminalInterview(ui: Prompts & { rich: RichPrompts }, guide: Guide, initial: Answers): Promise<Answers> {
  const fields = guide.steps.flatMap((step, index) => step.fields.map(field => ({ field, step: step.title, stage: index + 1 })));
  const answers: Answers = Object.create(null), cache = { ...initial }, visited: number[] = [];
  let index = 0;
  while (index < fields.length) {
    const entry = fields[index]!;
    if (!visible(entry.field.when, answers)) { delete answers[entry.field.id]; index++; continue; }
    ui.rich.context({ title: String(answers.title ?? initial.title ?? 'Prototype'),
      location: `Prototype / ${entry.step}`, details: [`Step ${entry.stage} of ${guide.steps.length}`, `Question ${index + 1} of ${fields.length}`,
        '', entry.field.help, '', 'Escape: previous question', 'F1: keyboard help'] });
    try {
      const result = await terminalField(ui.rich, guide, entry.field, answers, defaultValue(entry.field, cache));
      cache[entry.field.id] = result; answers[entry.field.id] = result; visited.push(index++);
    } catch (error) {
      if (!(error instanceof Back) || !visited.length) throw error;
      index = visited.pop()!;
      for (const later of fields.slice(index)) delete answers[later.field.id];
    }
  }
  return answers;
}
