import { randomUUID } from 'node:crypto';

async function releaseSession(session, objectGroup) {
  const failures = [];
  try { await session.send('Runtime.releaseObjectGroup', { objectGroup }); } catch (error) { failures.push(error); }
  try { await session.detach(); } catch (error) { failures.push(error); }
  return failures;
}
const message = error => String(error?.message ?? error);
function cleanupError(code, errors) {
  return new AggregateError(errors, `${code}: ${errors.map(message).join(' | ')}`);
}
function requireHandler(listeners) {
  const clicks = listeners.filter(listener => listener.type === 'click');
  const handlers = clicks.filter(listener => listener.handler?.objectId);
  if (clicks.length === 1 && handlers.length === 1) return handlers[0].handler.objectId;
  const details = { listenerCount: listeners.length, clickListeners: clicks.length, callableHandlers: handlers.length,
    originalHandlers: clicks.filter(listener => listener.originalHandler?.objectId).length,
    listeners: listeners.map(listener => ({ type: listener.type === 'click' ? 'click' : 'other',
      hasHandler: !!listener.handler?.objectId, hasOriginalHandler: !!listener.originalHandler?.objectId })) };
  const code = clicks.length > 1 ? 'NATIVE_RECOVERY_HANDLER_AMBIGUOUS' : 'NATIVE_RECOVERY_HANDLER_MISSING';
  throw new Error(`${code}: ${JSON.stringify(details)}`);
}
/** Public CDP handles retain the real registered function after DOM listeners are removed. */
export async function retainNativeAction(page, label, selector = '.notice button') {
  const session = await page.context().newCDPSession(page); const objectGroup = `native-recovery:${randomUUID()}`;
  try {
    // Chromium 150's DOMDebugger exposes handler objects only for a named node group.
    // https://raw.githubusercontent.com/chromium/chromium/150.0.7871.212/third_party/blink/renderer/core/inspector/inspector_dom_debugger_agent.cc
    const button = await session.send('Runtime.evaluate', {
      expression: `Array.from(document.querySelectorAll(${JSON.stringify(selector)})).find(button => button.textContent.trim() === ${JSON.stringify(label)})`,
      returnByValue: false, objectGroup,
    });
    if (button.exceptionDetails || !button.result?.objectId) throw new Error('NATIVE_RECOVERY_BUTTON_MISSING');
    const { listeners } = await session.send('DOMDebugger.getEventListeners', { objectId: button.result.objectId });
    const handler = requireHandler(listeners); let calls = 0; let disposed = false;
    return {
      async invoke() {
        if (disposed) throw new Error('NATIVE_RECOVERY_HANDLE_DISPOSED');
        const result = await session.send('Runtime.callFunctionOn', { objectId: handler,
          functionDeclaration: 'function () { return this(); }', awaitPromise: true, returnByValue: true, objectGroup });
        if (result.exceptionDetails) throw new Error('NATIVE_RECOVERY_HANDLER_FAILED'); calls++;
      },
      calls: () => calls,
      async dispose() {
        if (disposed) return; disposed = true;
        const failures = await releaseSession(session, objectGroup);
        if (failures.length) throw cleanupError('NATIVE_RECOVERY_HANDLE_CLEANUP', failures);
      },
    };
  } catch (error) {
    const failures = await releaseSession(session, objectGroup);
    if (failures.length) throw cleanupError('NATIVE_RECOVERY_HANDLE_SETUP', [error, ...failures]);
    throw error;
  }
}

/** Both actions run in one renderer turn, so the real 300 ms timer cannot fire between them. */
export function startAndCloseRecovery(element) {
  const button = Array.from(element.querySelectorAll('button')).find(candidate => candidate.textContent.trim() === 'Try owned recovery');
  const leaf = window.app.workspace.getLeavesOfType(element.dataset.type).find(candidate => candidate.view.containerEl === element);
  if (!button || !leaf) throw new Error('NATIVE_RECOVERY_OWNER_MISSING');
  button.click(); leaf.detach();
}
