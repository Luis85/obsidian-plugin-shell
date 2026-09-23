import { expect, it, vi } from 'vitest';
import { ModalService } from '../../src/application/modal-service';
import { NoticeService } from '../../src/application/notice-service';
import type { ModalCallbacks, ModalPresentation, ModalState } from '../../src/application/modal-port';
import { failure, success, type Result } from '../../src/domain/outcome';
import { deferred, host } from './helpers';
function fixture() {
  const dialogs: { spec: ModalPresentation; callbacks: ModalCallbacks; update: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> }[] = [];
  const errors = { report: vi.fn() }; const text = vi.fn((key: string) => key);
  const sink = { open: vi.fn((spec: ModalPresentation, callbacks: ModalCallbacks) => {
    const dialog = { spec, callbacks, update: vi.fn((_state: ModalState) => undefined), close: vi.fn(() => callbacks.cancel()) }; dialogs.push(dialog); return dialog;
  }) };
  const service = new ModalService(sink, text, errors, key => key !== 'unknown');
  const request = { owner: 'view:modal', titleKey: 'modal.title', messageKey: 'modal.text' };
  return { dialogs, errors, text, sink, service, request };
}
it('[MODAL-01] info and confirmation have explicit single terminal outcomes and idempotent owned cleanup', async () => {
  const f = fixture();
  const info = f.service.info(f.request); f.dialogs[0]?.callbacks.submit('ignored'); f.dialogs[0]?.callbacks.cancel();
  expect(await info).toEqual({ status: 'confirmed', value: undefined }); expect(f.dialogs[0]?.close).toHaveBeenCalledOnce();
  const confirmed = f.service.confirm(f.request); f.dialogs[1]?.callbacks.submit(null); f.dialogs[1]?.callbacks.submit(null);
  expect(await confirmed).toEqual({ status: 'confirmed', value: true }); expect(f.dialogs[1]?.close).toHaveBeenCalledOnce();
  const cancelled = f.service.confirm(f.request); f.dialogs[2]?.callbacks.cancel(); expect(await cancelled).toEqual({ status: 'cancelled' });
  f.service.closeOwner('missing'); f.service.dispose(); f.service.dispose(); expect(f.errors.report).not.toHaveBeenCalled();
  expect(await f.service.info(f.request)).toMatchObject({ status: 'failed', error: { code: 'disposed', effect: 'none' } });
});
it('[MODAL-02] prompt validation preserves entered data, blocks duplicate submit and guards late owner cancellation', async () => {
  const f = fixture(); const validation = deferred<ReturnType<typeof success<string>>>(); const validate = vi.fn(() => validation.promise);
  const pending = f.service.prompt({ ...f.request, initialValue: 'draft', maxLength: 10, validate }); const dialog = f.dialogs[0];
  dialog?.callbacks.submit('draft'); dialog?.callbacks.submit('duplicate'); expect(validate).toHaveBeenCalledOnce();
  expect(dialog?.update).toHaveBeenCalledWith({ busy: true, error: null }); f.service.closeOwner(f.request.owner);
  expect(await pending).toEqual({ status: 'cancelled' }); validation.resolve(success('changed')); await Promise.resolve(); await Promise.resolve();
  expect(dialog?.close).toHaveBeenCalledOnce(); expect(dialog?.update).toHaveBeenCalledTimes(1); f.service.dispose();
});
it('[MODAL-03] invalid prompt values remain correctable and normalized values are returned as typed data', async () => {
  const f = fixture(); const validate = vi.fn((value: string) => value.trim() ? success(value.trim()) : failure('validation', 'modal.invalid'));
  const pending = f.service.prompt({ ...f.request, maxLength: 5, validate }); const dialog = f.dialogs[0];
  dialog?.callbacks.submit({ secret: true }); expect(dialog?.update).toHaveBeenLastCalledWith({ busy: false, error: 'modal.invalid' });
  dialog?.callbacks.submit('123456'); expect(validate).not.toHaveBeenCalled();
  dialog?.callbacks.submit(' '); await Promise.resolve(); expect(dialog?.update).toHaveBeenLastCalledWith({ busy: false, error: 'modal.invalid' });
  expect(dialog?.close).not.toHaveBeenCalled(); dialog?.callbacks.submit(' ok '); expect(await pending).toEqual({ status: 'confirmed', value: 'ok' });
  expect(f.errors.report).not.toHaveBeenCalled(); f.service.dispose();
});
it('[MODAL-04] one owner replaces its previous request and runtime disposal cancels independent owners', async () => {
  const f = fixture(); const first = f.service.confirm(f.request); const replacement = f.service.prompt(f.request);
  expect(await first).toEqual({ status: 'cancelled' }); const other = f.service.info({ owner: 'runtime', titleKey: 'debug.title', message: '{"safe":"<text>"}' });
  expect(f.dialogs[2]?.spec.message).toBe('{"safe":"<text>"}'); f.service.dispose();
  expect(await replacement).toEqual({ status: 'cancelled' }); expect(await other).toEqual({ status: 'cancelled' });
  for (const dialog of f.dialogs) { expect(dialog.close).toHaveBeenCalledOnce(); dialog.callbacks.submit('late'); }
});
it('[MODAL-05] malformed request, missing sink and capacity never pretend that the user confirmed', async () => {
  const f = fixture();
  for (const patch of [{ owner: '' }, { titleKey: 'unknown' }, { maxLength: 0 }, { maxLength: 10001 }, { initialValue: 'x'.repeat(1001) }]) {
    expect(await f.service.prompt({ ...f.request, ...patch })).toMatchObject({ status: 'failed', error: { effect: 'none' } });
  }
  expect(await f.service.info({ owner: 'owner', titleKey: 'modal.title', message: 'x'.repeat(64001) })).toMatchObject({ status: 'failed' });
  expect(await f.service.info({ get owner(): string { throw new Error('request getter'); }, titleKey: 'title', message: '' })).toMatchObject({ status: 'failed' });
  const brokenKeys = new ModalService(f.sink, f.text, f.errors, () => { throw new Error('key catalog'); }); expect(await brokenKeys.info(f.request)).toMatchObject({ status: 'failed' }); brokenKeys.dispose();
  expect(f.sink.open).not.toHaveBeenCalled();
  const missing = new ModalService(undefined, key => key, f.errors); expect(await missing.confirm(f.request)).toMatchObject({ status: 'failed' }); missing.dispose();
  const pending = Array.from({ length: 16 }, (_, i) => f.service.confirm({ ...f.request, owner: `owner-${i}` }));
  expect(await f.service.confirm({ ...f.request, owner: 'overflow' })).toMatchObject({ status: 'failed' });
  f.service.dispose(); expect((await Promise.all(pending)).every(value => value.status === 'cancelled')).toBe(true);
});
it('[MODAL-06] validation, translation, native update and close failures stay independent and bounded', async () => {
  const f = fixture();
  const bad = f.service.prompt({ ...f.request, validate: () => { throw new Error('validation failed'); } }); f.dialogs[0]?.callbacks.submit('input');
  expect(await bad).toMatchObject({ status: 'failed' }); expect(f.errors.report).toHaveBeenCalledWith('modal.validation', 'modal.submit');
  const invalidKey = f.service.prompt({ ...f.request, validate: () => failure('validation', 'unknown') }); f.dialogs[1]?.callbacks.submit('input'); expect(await invalidKey).toMatchObject({ status: 'failed' });
  const oversized = f.service.prompt({ ...f.request, maxLength: 1, validate: () => success('too long') }); f.dialogs[2]?.callbacks.submit('x'); await Promise.resolve();
  expect(f.dialogs[2]?.update).toHaveBeenLastCalledWith({ busy: false, error: 'modal.invalid' }); f.service.closeOwner(f.request.owner); await oversized;
  const failedUpdate = f.service.confirm(f.request); f.dialogs[3]?.update.mockImplementationOnce(() => { throw new Error('update'); }); f.dialogs[3]?.callbacks.submit(''); expect(await failedUpdate).toMatchObject({ status: 'failed' });
  const failedClose = f.service.info(f.request); f.dialogs[4]?.close.mockImplementationOnce(() => { throw new Error('close'); }); f.dialogs[4]?.callbacks.submit(''); expect(await failedClose).toEqual({ status: 'confirmed', value: undefined });
  f.text.mockImplementationOnce(() => { throw new Error('translator'); }); expect(await f.service.info(f.request)).toMatchObject({ status: 'failed' });
  expect(f.errors.report.mock.calls.map(([code]) => code)).toEqual(['modal.validation', 'modal.validation', 'modal.update', 'modal.close', 'modal.open']); f.service.dispose();
});
it('[MODAL-07] synchronous open cancellation cleans its returned handle while opening failure stays failure', async () => {
  const errors = { report: vi.fn() }; const close = vi.fn();
  const cancelled = new ModalService({ open(_spec, callbacks) { callbacks.cancel(); return { update() {}, close }; } }, key => key, errors);
  expect(await cancelled.info({ owner: 'one', titleKey: 'title', message: '' })).toEqual({ status: 'cancelled' }); expect(close).toHaveBeenCalledOnce(); cancelled.dispose();
  const failed = new ModalService({ open(_spec, callbacks) { callbacks.cancel(); throw new Error('partial open'); } }, key => key, errors);
  expect(await failed.confirm({ owner: 'two', titleKey: 'title', message: '' })).toMatchObject({ status: 'failed' }); failed.dispose();
  const submitted = new ModalService({ open(_spec, callbacks) { callbacks.submit('value'); return { update() {}, close }; } }, key => key, errors);
  expect(await submitted.prompt({ owner: 'three', titleKey: 'title', message: '' })).toEqual({ status: 'confirmed', value: 'value' }); submitted.dispose();
});
it('[MODAL-08] caller mutations cannot change reviewed validation or leak the original owner registration', async () => {
  const f = fixture();
  const request = { ...f.request, validate: (value: string): Result<string> => success(`original:${value}`) };
  const pending = f.service.prompt(request); request.owner = 'changed-owner'; request.messageKey = 'changed-message'; request.validate = () => success('MUTATED');
  expect(f.dialogs[0]?.spec.message).toBe('modal.text'); f.dialogs[0]?.callbacks.submit('value');
  expect(await pending).toEqual({ status: 'confirmed', value: 'original:value' });
  const followups = Array.from({ length: 16 }, (_, i) => f.service.confirm({ ...f.request, owner: `next-${i}` }));
  expect(f.sink.open).toHaveBeenCalledTimes(17); f.service.dispose();
  expect((await Promise.all(followups)).every(outcome => outcome.status === 'cancelled')).toBe(true); expect(f.errors.report).not.toHaveBeenCalled();
});
it('[MODAL-09] reentrant closing cannot open a modal after disposal or orphan a successor from the same owner', async () => {
  const f = fixture(); const first = f.service.info(f.request); f.dialogs[0]?.close.mockImplementationOnce(() => f.service.dispose());
  const replacement = f.service.info(f.request); expect(await first).toEqual({ status: 'cancelled' }); expect(await replacement).toMatchObject({ status: 'failed', error: { code: 'disposed' } });
  expect(f.sink.open).toHaveBeenCalledOnce(); f.service.dispose();
  const nested = fixture(); const original = nested.service.info(nested.request); let successor: ReturnType<ModalService['info']> | undefined;
  nested.dialogs[0]?.close.mockImplementationOnce(() => { successor = nested.service.info(nested.request); });
  const superseded = nested.service.info(nested.request); expect(await original).toEqual({ status: 'cancelled' }); expect(await superseded).toEqual({ status: 'cancelled' });
  expect(nested.sink.open).toHaveBeenCalledTimes(2); nested.service.dispose(); expect(await successor).toEqual({ status: 'cancelled' });
});
it('[MODAL-10] validation results are read once so accessors cannot replace reviewed values or error keys', async () => {
  const f = fixture(); let reads = 0; const value = success('unused');
  Object.defineProperty(value, 'value', { get: () => ++reads === 1 ? 'safe' : { private: 'SECRET' } });
  const pending = f.service.prompt({ ...f.request, validate: () => value }); f.dialogs[0]?.callbacks.submit('input');
  expect(await pending).toEqual({ status: 'confirmed', value: 'safe' }); expect(reads).toBe(1);
  let keyReads = 0; const invalid = failure('validation', 'unused'); if (invalid.ok) throw new Error('EXPECTED_FAILURE');
  Object.defineProperty(invalid.error, 'key', { get: () => ++keyReads === 1 ? 'modal.invalid' : 'private.value' });
  const corrected = f.service.prompt({ ...f.request, validate: () => invalid }); f.dialogs[1]?.callbacks.submit('input'); await Promise.resolve();
  expect(keyReads).toBe(1); expect(f.dialogs[1]?.update).toHaveBeenLastCalledWith({ busy: false, error: 'modal.invalid' });
  f.service.dispose(); expect(await corrected).toEqual({ status: 'cancelled' }); expect(f.errors.report).not.toHaveBeenCalled();
});
it('[NOTICE-01] first-class convenience methods use the same one-policy owned handles', () => {
  const service = new NoticeService(host(), key => key, { report: vi.fn() }, { scheduler: { after: () => () => undefined } });
  const request = { owner: 'owner', operation: 'example', key: 'message' };
  const info = service.info(request); const successNotice = service.success(request); const warning = service.warning(request); const error = service.error(request); const progress = service.progress(request);
  expect([info?.id, successNotice?.id, warning?.id, error?.id, progress?.id]).toEqual([info?.id, info?.id, info?.id, info?.id, info?.id]); expect(service.current).toHaveLength(1);
  expect(service.current[0]?.kind).toBe('progress'); service.dispose();
});
