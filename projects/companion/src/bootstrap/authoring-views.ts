import { defineCommand } from '../application/command-definitions';
import { pluginIdentity } from '../infrastructure/plugin-identity';

export function authoringViewDefinitions(panels: readonly { readonly id: string; readonly titleKey: string }[]) {
  const seen = new Set<string>();
  return panels.map(panel => {
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(panel.id) || panel.id.length > 54 || seen.has(panel.id)) throw new Error('AUTHORING_VIEW_ID');
    seen.add(panel.id);
    return { ...panel, type: `${pluginIdentity.id}-view-${panel.id}` };
  });
}
export function authoringViewCommands(panels: readonly { readonly id: string; readonly titleKey: string }[], open: (id: string) => Promise<void>) {
  return { commands: authoringViewDefinitions(panels).map(panel => defineCommand({
    id: `${panel.id}-open-view`, titleKey: panel.titleKey, icon: 'panel-top', execute: () => open(panel.id),
  })) };
}
