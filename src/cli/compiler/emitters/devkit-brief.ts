/** Values for the generated BRIEF.md: what the design already says, with every gap left as a TODO(owner)
 * for the product owner. Nothing here invents a product decision; it only restates design data. */
import type { Model } from './model.ts';

const oneLine = (value: unknown, max = 160): string => {
  const flat = String(value ?? '').replace(/\s+/g, ' ').trim();
  return flat.length > max ? flat.slice(0, max - 1) + '…' : flat;
};
const section = (lines: readonly string[], empty: string): string => (lines.length ? lines : [`- TODO(owner): ${empty}`]).join('\n');

export function briefValues(m: Model): Record<string, string> {
  const design = (m.document.design ?? {}) as Record<string, unknown>;
  const goal = oneLine(design.goal);
  return {
    briefGoal: goal ? `Design goal from the prototype (confirm or replace): ${goal}` : 'TODO(owner): not stated in the design.',
    briefSurfaces: section(m.screens.map(screen => `- ${oneLine(screen.label, 80)} (${screen.kind}${screen.entry ? ', entry' : ''})`), 'the design declares no screens; list the surfaces the user sees.'),
    briefData: section(m.entities.map(entity => `- ${oneLine(entity.name, 80)}`), 'the design declares no stored entities; say what data the plugin keeps.'),
    briefJourneys: section(m.requirements.map(item => `- ${oneLine(item.title, 100)} (requirement \`${item.key}\`)`), 'the design declares no requirements; list the journeys that must work.'),
  };
}
