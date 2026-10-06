export interface FixtureAdapter {
execute(id: string, input?: unknown, options?: { signal?: AbortSignal }): Promise<unknown>;
port(source: string): Readonly<Record<string, (input?: unknown, options?: { signal?: AbortSignal }) => Promise<unknown>>>;
reset(): void; captured(): Array<{operation: string; direction: string; input: unknown}>; dispose(): void;
}
export function createFixtureAdapter(manifest: unknown): FixtureAdapter;
