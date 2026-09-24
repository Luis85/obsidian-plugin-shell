/** Public CDP handles retain the real registered function after DOM listeners are removed. */
export async function retainNativeAction(page, label) {
  const session = await page.context().newCDPSession(page); const objects = [];
  try {
    const button = await session.send('Runtime.evaluate', {
      expression: `Array.from(document.querySelectorAll('.notice button')).find(button => button.textContent.trim() === ${JSON.stringify(label)})`,
      returnByValue: false,
    });
    if (button.exceptionDetails || !button.result?.objectId) throw new Error('NATIVE_RECOVERY_BUTTON_MISSING');
    objects.push(button.result.objectId);
    const { listeners } = await session.send('DOMDebugger.getEventListeners', { objectId: button.result.objectId });
    const handlers = listeners.filter(listener => listener.type === 'click' && listener.handler?.objectId);
    if (handlers.length !== 1) throw new Error('NATIVE_RECOVERY_HANDLER_AMBIGUOUS');
    const handler = handlers[0].handler.objectId; objects.push(handler); let calls = 0;
    return {
      async invoke() {
        const result = await session.send('Runtime.callFunctionOn', { objectId: handler,
          functionDeclaration: 'function () { return this(); }', awaitPromise: true, returnByValue: true });
        if (result.exceptionDetails) throw new Error('NATIVE_RECOVERY_HANDLER_FAILED'); calls++;
      },
      calls: () => calls,
      async dispose() {
        const failures = [];
        for (const objectId of objects) {
          try { await session.send('Runtime.releaseObject', { objectId }); } catch (error) { failures.push(error); }
        }
        try { await session.detach(); } catch (error) { failures.push(error); }
        if (failures.length) throw new AggregateError(failures, 'NATIVE_RECOVERY_HANDLE_CLEANUP');
      },
    };
  } catch (error) {
    try { await session.detach(); } catch (cleanup) { throw new AggregateError([error, cleanup], 'NATIVE_RECOVERY_HANDLE_SETUP'); }
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
