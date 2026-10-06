/** Diagnostic receipt times are not renderer throw times or causal attribution. */
function record(report, kind, details = {}) {
  report.nativeDiagnostics.events.push({
    at: new Date().toISOString(), monotonicMs: performance.now(),
    kind, phase: report.phase ?? 'initial-smoke', ...details,
  });
}

export function noteNativePhase(report, phase) {
  report.phase = phase;
  record(report, 'phase');
}

/** Keep legacy errors and acceptance unchanged; add stable page IDs and a timeline. */
export function createNativeDiagnosticObserver(report) {
  if (report.nativeDiagnostics) throw new Error('NATIVE_DIAGNOSTICS_ALREADY_ATTACHED');
  report.nativeDiagnostics = {
    schemaVersion: 1,
    clock: 'driver Date/performance.now receipt time; not renderer throw time',
    events: [],
  };
  const pages = new Map();
  let disposed = false;
  record(report, 'phase');
  return {
    observe(page) {
      if (disposed) throw new Error('NATIVE_DIAGNOSTICS_DISPOSED');
      if (pages.has(page)) return;
      const pageId = pages.size + 1;
      const details = () => ({ pageId, url: page.url() });
      const onError = error => {
        const errorIndex = report.errors.length;
        report.errors.push({ message: error.message.slice(0, 300), stack: error.stack?.slice(0, 3000),
          url: page.url(), phase: report.phase ?? 'initial-smoke' });
        record(report, 'pageerror', { ...details(), errorIndex });
      };
      const onClose = () => record(report, 'page-close', details());
      pages.set(page, { onError, onClose });
      page.on('pageerror', onError);
      page.on('close', onClose);
      record(report, 'page-observed', details());
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const [page, { onError, onClose }] of pages) {
        page.off('pageerror', onError);
        page.off('close', onClose);
      }
      pages.clear();
      record(report, 'observer-disposed');
    },
  };
}
