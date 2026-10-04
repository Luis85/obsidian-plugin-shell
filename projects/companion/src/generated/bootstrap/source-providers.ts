import type { Services } from "../../bootstrap/services.ts";
import type { SourcePorts } from '../application/sources.ts';
/** Developer-owned runtime configuration. Portable JSON never authorizes network access.
 * Return complete source ports. Dispose each configured provider on plugin unload. */
export const configureSourceProviders: (shell: Services) => {ports: Partial<SourcePorts>; dispose(): void} = () => ({ports: {}, dispose() {}});
