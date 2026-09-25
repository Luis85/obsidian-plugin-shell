import { literal, symbol, type Model } from './model.ts';
import type { Add } from './data-code.ts';
export function detailPorts(m: Model, add: Add): void {
  const imports: string[] = []; const stores: string[] = []; const entries: string[] = [];
  for (const source of m.sources) {
    const name = symbol(source.slug);
    imports.push(`import { define${name}Store } from '../presentation/stores/${source.slug}.ts';`);
    imports.push(`import * as ${name}Contracts from '../application/${source.slug}/contracts.ts';`);
    stores.push(`const ${name} = define${name}Store(sources[${literal(source.slug)}])(pinia);`);
    for (const op of source.operations) {
      const state = `${name}[${literal(op.slug)}]`;
      entries.push(`{ sourceId: ${literal(source.id)}, operationId: ${literal(op.id)}, direction: ${literal(op.direction)}, requiresInput: ${op.input !== null},
get data() { return ${state}.data; }, get pending() { return ${state}.pending; }, get error() { return ${state}.error; },
async run(input) { if (!${name}Contracts.is${symbol(op.slug)}Input(input)) throw new Error('INVALID_INPUT'); return ${state}.execute(input); } }`);
    }
  }
  add(`${m.sourceRoot}/bootstrap/detail-context.ts`, `${imports.join('\n')}
import type { Pinia } from 'pinia';
import type { Sources } from '../application/sources.ts';
import type { DetailContext } from '../presentation/composables/use-detail.ts';
import { screens } from '../domain/screens.ts';
import { useNavigation } from '../presentation/stores/navigation.ts';
import { handleDetailInteraction } from '../application/detail-interactions.ts';
export function createDetailContext(sources: Sources, pinia: Pinia, openModal: (id: string) => void): DetailContext {
${stores.join('\n')}
const navigation = useNavigation(pinia);
return { ports: [${entries.join(',\n')}], handle: request => handleDetailInteraction(request, sources), navigate(target) {
  const screen = screens.find(s => s.id === target); if (!screen || ['action', 'group'].includes(screen.kind)) throw new Error('SCREEN_NOT_NAVIGABLE');
  if (screen.kind === 'modal') openModal(target); else navigation.open(target);
} };
}
`, 'managed');
}
