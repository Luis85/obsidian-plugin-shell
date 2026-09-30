import type { WorkbenchPluginObject } from './api.ts';

/**
 * Trusted Workbench extension composition root.
 *
 * A developer adds an explicit import and registry entry here. Workbench never
 * scans plugin folders or executes unregistered files merely because they exist.
 */
export const pluginRegistry: readonly WorkbenchPluginObject[] = Object.freeze([]);
