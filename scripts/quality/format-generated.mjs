import { format, check } from 'prettier';

// No import/class sorting. Markdown fixtures are exact application bytes, not prose.
const formatOptions = Object.freeze({ singleQuote: true, printWidth: 120, trailingComma: 'all', endOfLine: 'lf' });
const sourceExtension = /\.(?:[cm]?[jt]s|vue|css|json|ya?ml)$/;
export async function formatGenerated(entries) {
  return Promise.all(entries.map(async entry => entry.content !== null && sourceExtension.test(entry.path)
    ? { ...entry, content: await format(entry.content, { ...formatOptions, filepath: entry.path }) } : entry));
}
export async function checkGenerated(entries) {
  const failures = [];
  for (const entry of entries) {
    if (entry.content !== null && sourceExtension.test(entry.path) && !await check(entry.content, { ...formatOptions, filepath: entry.path })) failures.push(entry.path);
  }
  return failures;
}
