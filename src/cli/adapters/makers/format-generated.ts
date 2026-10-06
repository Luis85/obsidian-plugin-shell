// Explicit standalone plugins keep formatting available in the portable CLI without a node_modules tree.
const loadPrettier = async () => {
  const [prettier, ...plugins] = await Promise.all([
    import('prettier/standalone'), import('prettier/plugins/babel'), import('prettier/plugins/estree'),
    import('prettier/plugins/typescript'), import('prettier/plugins/html'), import('prettier/plugins/postcss'), import('prettier/plugins/yaml'),
  ]);
  return { format: (source: string, filepath: string) => prettier.format(source, { ...formatOptions, filepath, plugins }) };
};

interface GeneratedEntry { readonly path: string; readonly content: string | null }
// No import/class sorting. Markdown fixtures are exact application bytes, not prose.
const formatOptions = Object.freeze({ singleQuote: true, printWidth: 120, trailingComma: 'all', endOfLine: 'lf' } as const);
const sourceExtension = /\.(?:[cm]?[jt]s|vue|css|json|ya?ml)$/;
const formattable = (entry: GeneratedEntry): entry is GeneratedEntry & { readonly content: string } => entry.content !== null && sourceExtension.test(entry.path);
export async function formatGenerated<Entry extends GeneratedEntry>(entries: readonly Entry[]): Promise<Entry[]> {
  const { format } = await loadPrettier();
  return Promise.all(entries.map(async entry => formattable(entry)
    ? { ...entry, content: await format(entry.content, entry.path) } : entry));
}
export async function checkGenerated(entries: readonly GeneratedEntry[]): Promise<string[]> {
  const failures: string[] = [], { format } = await loadPrettier();
  for (const entry of entries) {
    if (formattable(entry) && await format(entry.content, entry.path) !== entry.content) failures.push(entry.path);
  }
  return failures;
}
