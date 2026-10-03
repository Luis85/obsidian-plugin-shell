import { format, check } from 'prettier';

interface GeneratedEntry { readonly path: string; readonly content: string | null }
// No import/class sorting. Markdown fixtures are exact application bytes, not prose.
const formatOptions = Object.freeze({ singleQuote: true, printWidth: 120, trailingComma: 'all', endOfLine: 'lf' } as const);
const sourceExtension = /\.(?:[cm]?[jt]s|vue|css|json|ya?ml)$/;
const formattable = (entry: GeneratedEntry): entry is GeneratedEntry & { readonly content: string } => entry.content !== null && sourceExtension.test(entry.path);
export async function formatGenerated<Entry extends GeneratedEntry>(entries: readonly Entry[]): Promise<Entry[]> {
  return Promise.all(entries.map(async entry => formattable(entry)
    ? { ...entry, content: await format(entry.content, { ...formatOptions, filepath: entry.path }) } : entry));
}
export async function checkGenerated(entries: readonly GeneratedEntry[]): Promise<string[]> {
  const failures: string[] = [];
  for (const entry of entries) {
    if (formattable(entry) && !await check(entry.content, { ...formatOptions, filepath: entry.path })) failures.push(entry.path);
  }
  return failures;
}
