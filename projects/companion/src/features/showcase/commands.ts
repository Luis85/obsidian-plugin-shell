import { defineCommand, defineRibbon } from '../api';
import type { Result } from '../../domain/outcome';

interface ShowcaseActions {
  openShowcase(): Promise<void>;
  toggleHeader(): Promise<void | Result<unknown>>;
  canToggleHeader(): boolean;
}
/** Feature authors describe actions here; native handles never enter this module. */
export function createShowcaseCommands(actions: ShowcaseActions) {
  const open = defineCommand({ id: 'open-showcase', titleKey: 'command.open', icon: 'blocks', execute: () => actions.openShowcase() });
  const toggle = defineCommand({ id: 'toggle-view-header', titleKey: 'command.toggleHeader',
    available: () => actions.canToggleHeader(), execute: () => actions.toggleHeader() });
  return { commands: [open, toggle], ribbons: [defineRibbon(open, { id: 'showcase', icon: 'blocks' })] };
}
