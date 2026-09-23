import type { Result } from '../domain/outcome';

export interface CommandDefinition<Id extends string = string> {
  readonly id: Id;
  readonly titleKey: string;
  readonly icon?: string;
  /** Pure synchronous query. Checking availability never calls execute. */
  readonly available?: () => boolean;
  readonly execute: () => void | Result<unknown> | Promise<void | Result<unknown>>;
}
export interface RibbonDefinition<CommandId extends string = string, Id extends string = string> {
  readonly id: Id;
  readonly command: CommandDefinition<CommandId>;
  readonly icon: string;
  readonly titleKey: string;
}
export interface CommandGroup {
  readonly commands: readonly CommandDefinition[];
  readonly ribbons?: readonly RibbonDefinition[];
}
const identifier = (value: unknown): value is string => typeof value === 'string' && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value) && value.length <= 64;
const label = (value: unknown): value is string => typeof value === 'string' && /^[a-z][a-zA-Z0-9_.-]{0,99}$/.test(value);
const icon = (value: unknown): value is string => typeof value === 'string' && /^[a-z][a-z0-9-]{0,79}$/.test(value);

/** Feature-owned callbacks close over narrow injected application capabilities. */
export function defineCommand<const Id extends string>(definition: CommandDefinition<Id>): CommandDefinition<Id> {
  if (!definition || !identifier(definition.id) || !label(definition.titleKey) || typeof definition.execute !== 'function'
    || (definition.available !== undefined && typeof definition.available !== 'function') || (definition.icon !== undefined && !icon(definition.icon))) throw new Error('INVALID_COMMAND_DEFINITION');
  return Object.freeze({ ...definition });
}
/** Reference the command itself so palette and ribbon cannot acquire separate handlers. */
export function defineRibbon<const CommandId extends string, const Id extends string>(command: CommandDefinition<CommandId>, definition: { readonly id: Id; readonly icon: string; readonly titleKey?: string }): RibbonDefinition<CommandId, Id> {
  if (!definition || !identifier(definition.id) || !icon(definition.icon) || !command || !identifier(command.id)) throw new Error('INVALID_RIBBON_DEFINITION');
  const titleKey = definition.titleKey ?? command.titleKey;
  if (!label(titleKey)) throw new Error('INVALID_RIBBON_DEFINITION');
  return Object.freeze({ ...definition, titleKey, command });
}

export function commandCatalog(groups: readonly CommandGroup[], validKey: (key: string) => boolean) {
  const commands = new Map<string, CommandDefinition>(); const ribbons: RibbonDefinition[] = []; const ribbonIds = new Set<string>();
  for (const group of groups) {
    if (!group || !Array.isArray(group.commands) || (group.ribbons !== undefined && !Array.isArray(group.ribbons))) throw new Error('INVALID_COMMAND_GROUP');
    for (const command of group.commands) {
      defineCommand(command);
      if (commands.has(command.id)) throw new Error(`DUPLICATE_COMMAND_ID:${command.id}`);
      if (commands.size >= 100) throw new Error('COMMAND_CATALOG_LIMIT');
      if (!validKey(command.titleKey)) throw new Error(`UNKNOWN_COMMAND_LABEL:${command.titleKey}`);
      commands.set(command.id, command);
    }
    for (const ribbon of group.ribbons ?? []) {
      defineRibbon(ribbon.command, ribbon);
      if (ribbonIds.has(ribbon.id)) throw new Error(`DUPLICATE_RIBBON_ID:${ribbon.id}`);
      if (ribbons.length >= 100) throw new Error('RIBBON_CATALOG_LIMIT');
      if (!validKey(ribbon.titleKey)) throw new Error(`UNKNOWN_COMMAND_LABEL:${ribbon.titleKey}`);
      ribbonIds.add(ribbon.id); ribbons.push(ribbon);
    }
  }
  for (const ribbon of ribbons) if (commands.get(ribbon.command.id) !== ribbon.command) throw new Error(`RIBBON_COMMAND_NOT_REGISTERED:${ribbon.id}`);
  return Object.freeze({
    commands: Object.freeze([...commands.values()].map(command => defineCommand(command))),
    ribbons: Object.freeze(ribbons.map(ribbon => Object.freeze({ id: ribbon.id, commandId: ribbon.command.id, icon: ribbon.icon, titleKey: ribbon.titleKey }))),
  });
}
