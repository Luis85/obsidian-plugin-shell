/** Redirect third-party build diagnostics only inside the dedicated worker process.
 * Imports and asynchronous build hooks can write directly to stdout despite Vite's
 * logLevel. Keep those bytes on stderr without discarding diagnostics or parsing
 * a trailing JSON line. Restore stdout even when compilation rejects. */
export async function withBuildDiagnostics(task) {
  const original = process.stdout.write;
  process.stdout.write = process.stderr.write.bind(process.stderr);
  try {
    return await task();
  } finally {
    process.stdout.write = original;
  }
}
