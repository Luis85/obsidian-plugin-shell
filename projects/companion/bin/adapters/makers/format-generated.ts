// Loaded on first use like TypeScript: prettier is an installed devDependency, never bundled into the release CLI,
// so the dependency-free kit starts without it and ships no unlicensed third-party code.
const loadPrettier = async (): Promise<typeof import('prettier')> => import('prettier');

interface GeneratedEntry { readonly path: string; readonly content: string | null }
// No import/class sorting. Markdown fixtures are exact application bytes, not prose.
const formatOptions = Object.freeze({ singleQuote: true, printWidth: 120, trailingComma: 'all', endOfLine: 'lf' } as const);
const sourceExtension = /\.(?:[cm]?[jt]s|vue|css|json|ya?ml)$/;
const formattable = (entry: GeneratedEntry): entry is GeneratedEntry & { readonly content: string } => entry.content !== null && sourceExtension.test(entry.path);
export async function formatGenerated<Entry extends GeneratedEntry>(entries: readonly Entry[]): Promise<Entry[]> {
  const { format } = await loadPrettier();
  return Promise.all(entries.map(async entry => formattable(entry)
    ? { ...entry, content: await format(entry.content, { ...formatOptions, filepath: entry.path }) } : entry));
}
export async function checkGenerated(entries: readonly GeneratedEntry[]): Promise<string[]> {
  const failures: string[] = [], { check } = await loadPrettier();
  for (const entry of entries) {
    if (formattable(entry) && !await check(entry.content, { ...formatOptions, filepath: entry.path })) failures.push(entry.path);
  }
  return failures;
}
