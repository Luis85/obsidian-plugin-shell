/** Supplemental driver receipts cannot contradict the canonical renderer errors. */
export function validateNativeDiagnostics(report) {
  if (report.nativeDiagnostics === undefined) return;
  const fail = () => { throw new Error('EVIDENCE_NATIVE_DIAGNOSTICS'); };
  const shape = (value, fields) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)
      || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...fields].sort())) fail();
  };
  const diagnostic = report.nativeDiagnostics;
  shape(diagnostic, ['schemaVersion', 'clock', 'events']);
  if (diagnostic.schemaVersion !== 1 || diagnostic.clock !== 'driver Date/performance.now receipt time; not renderer throw time'
    || !Array.isArray(diagnostic.events) || diagnostic.events.length < 2 || !Array.isArray(report.errors)) fail();
  const pages = new Set(); let phase; let previous = -Infinity; let errors = 0; let disposed = false;
  for (const event of diagnostic.events) {
    if (disposed || !event || !['phase', 'page-observed', 'page-close', 'pageerror', 'observer-disposed'].includes(event.kind)) fail();
    const pageEvent = ['page-observed', 'page-close', 'pageerror'].includes(event.kind);
    shape(event, ['at', 'monotonicMs', 'kind', 'phase', ...(pageEvent ? ['pageId', 'url'] : []), ...(event.kind === 'pageerror' ? ['errorIndex'] : [])]);
    if (typeof event.at !== 'string' || !Number.isFinite(Date.parse(event.at)) || !Number.isFinite(event.monotonicMs)
      || event.monotonicMs < 0 || event.monotonicMs < previous || typeof event.phase !== 'string' || !event.phase) fail();
    previous = event.monotonicMs;
    if (event.kind === 'phase') phase = event.phase;
    if (event.phase !== phase) fail();
    if (pageEvent) {
      if (!Number.isSafeInteger(event.pageId) || event.pageId < 1 || typeof event.url !== 'string') fail();
      if (event.kind === 'page-observed') {
        if (event.pageId !== pages.size + 1 || pages.has(event.pageId)) fail();
        pages.add(event.pageId);
      } else if (!pages.has(event.pageId)) fail();
    }
    if (event.kind === 'pageerror') {
      const error = report.errors[errors];
      if (event.errorIndex !== errors || !error || error.phase !== event.phase || error.url !== event.url) fail();
      errors++;
    }
    if (event.kind === 'observer-disposed') disposed = true;
  }
  if (!disposed || errors !== report.errors.length || (report.phase ?? 'initial-smoke') !== phase) fail();
}
