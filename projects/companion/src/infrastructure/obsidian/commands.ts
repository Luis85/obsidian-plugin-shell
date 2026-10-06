import type { Plugin } from 'obsidian';
import type { CommandService } from '../../application/command-service';
import type { ErrorReporter } from '../../application/ports';

/** Only this boundary registers host commands/ribbons; callbacks share one dispatcher. */
export function bindCommands(plugin: Plugin, commands: CommandService, text: (key: string) => string, errors: ErrorReporter): () => void {
  const ids: string[] = []; const ribbons: HTMLElement[] = [];
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true; commands.dispose();
    for (const ribbon of ribbons) {
      try { ribbon.remove(); } catch { errors.report('command.ribbon-dispose', 'command.dispose'); }
    }
    for (const id of ids) {
      // Plugin.removeCommand prefixes the local ID; addCommand returns an already-prefixed ID.
      try { plugin.removeCommand(id); } catch { errors.report('command.unregister', 'command.dispose'); }
    }
  };
  try {
    for (const command of commands.catalog.commands) {
      // Track the intended local ID first: a host call can register and then throw.
      ids.push(command.id);
      plugin.addCommand({ id: command.id, name: text(command.titleKey), ...(command.icon ? { icon: command.icon } : {}),
        callback: () => { void commands.execute(command.id); },
        ...(command.available ? { checkCallback: (checking: boolean) => {
          const enabled = commands.available(command.id);
          if (!checking && enabled) void commands.execute(command.id);
          return enabled;
        } } : {}),
      });
    }
    for (const ribbon of commands.catalog.ribbons) {
      ribbons.push(plugin.addRibbonIcon(ribbon.icon, text(ribbon.titleKey), () => { void commands.execute(ribbon.commandId); }));
    }
    return dispose;
  } catch (error) { dispose(); throw error; }
}
