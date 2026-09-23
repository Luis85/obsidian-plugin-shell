import { CommandService } from '../application/command-service';
import { createShowcaseCommands } from '../features/showcase/commands';
import { createDebugCommands } from '../features/debugging/commands';
import { defineLogCatalog } from '../application/logging';
import type { Services } from './services';
import { authoringPanels } from './authoring';
import { authoringViewCommands } from './authoring-views';

/** Add one feature factory here; each factory receives only its required capabilities. */
export function createCommands(services: Services, navigation: { openShowcase(): Promise<void>; toggleHeader(): Promise<void>; openAuthoring?(id: string): Promise<void> }) {
  const correlations = new Map<string, ReturnType<Services['logger']['correlation']>>();
  const commands = new CommandService([
    createShowcaseCommands({ ...navigation, canToggleHeader: () => !services.preferences.readonly }),
    createDebugCommands({ debugging: services.debugging, modals: services.modals, notices: services.notices }),
    ...(navigation.openAuthoring ? [authoringViewCommands(authoringPanels, navigation.openAuthoring)] : []),
    ...services.authoring.groups,
  ], services.diagnostics, {
    validKey: key => services.i18n.global.te(key),
    onFailure: (error, id) => { services.notifications.show(`command:${id}`, 'error', error.key, true, 'runtime'); },
    observe(event) {
      if (event.phase === 'started') {
        const correlation = services.logger.correlation(); correlations.set(event.id, correlation);
        log.debug('started', event.id, { correlation });
      } else {
        const correlation = correlations.get(event.id); correlations.delete(event.id);
        const metadata = { ...(correlation ? { correlation } : {}), ...(event.effect ? { effect: event.effect } : {}) };
        if (event.phase === 'failed') log.warn('failed', event.id, metadata);
        else log.info('completed', event.id, metadata);
      }
    },
  });
  const log = services.logger.registerCatalog(defineLogCatalog('commands', { codes: ['started', 'completed', 'failed'], operations: commands.catalog.commands.map(command => command.id) }));
  return commands;
}
