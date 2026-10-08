/** Versioned JSON adapter over Node's real test events; never infer pass from text output. */
export default async function* reporter(source) {
  for await (const event of source) {
    if (event.type === 'test:pass' || event.type === 'test:fail') {
      const d = event.data;
      yield JSON.stringify({ kind: 'case', schemaVersion: 1, name: d.name, file: d.file,
        status: d.skip ? 'skipped' : d.todo ? 'todo' : event.type === 'test:pass' ? 'passed' : 'failed',
        type: d.details?.type, nesting: d.nesting,
        // Preserve bounded assertion failure details in this synthetic baseline only.
        error: d.details?.error ? String(d.details.error.message).slice(0, 1200) : null }) + '\n';
    }
    if (event.type === 'test:summary' && !event.data.file) {
      yield JSON.stringify({ kind: 'summary', schemaVersion: 1,
        success: event.data.success, counts: event.data.counts }) + '\n';
    }
  }
}
