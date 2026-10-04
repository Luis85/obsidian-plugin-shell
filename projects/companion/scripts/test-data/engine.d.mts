export interface GeneratedFixtures {
files: Array<{path: string; content: string; owner: string}>;
operations: Array<{id: string; source: string; slug: string; kind: string; input: {none?: boolean; schema?: unknown}; output: {none?: boolean; schema?: unknown}; inputValue: unknown; outputValue: unknown}>;
bytes: number;
}
export function createFixtureEngine(): {generate(manifest: unknown): GeneratedFixtures; matches(value: unknown, schema: unknown): boolean};
