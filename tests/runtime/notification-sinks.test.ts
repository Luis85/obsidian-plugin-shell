// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { nativeNotification } from '../../src/infrastructure/obsidian/notification-sink';
import { browserNotification } from '../../harness/app/notification-sink';
import { NoticeService } from '../../src/application/notice-service';
import { host } from './helpers';
const native = vi.hoisted(() => ({ notices: [] as { content: DocumentFragment; duration: number; hide: ReturnType<typeof vi.fn>; setMessage: ReturnType<typeof vi.fn> }[] }));
vi.mock('obsidian', () => ({ Notice: class {
  hide = vi.fn(); setMessage = vi.fn((content: DocumentFragment) => { this.content = content; });
  constructor(public content: DocumentFragment, public duration: number) { native.notices.push(this); }
} }));
beforeEach(() => {
  native.notices = []; vi.stubGlobal('createFragment', () => document.createDocumentFragment()); vi.stubGlobal('createEl', (tag: string) => document.createElement(tag));
});
afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); });
it('[NTF-SINK-01] native public Notice handles update safe text/actions and remove old listeners on update/disposal', () => {
  const invoke = vi.fn(); const handle = nativeNotification('<script>plain text</script>', [{ label: '<Open>', disabled: false, invoke }]);
  const notice = native.notices[0]; if (!notice) throw new Error('NOTICE_MISSING');
  expect(notice.duration).toBe(0); expect(notice.content.querySelector('script')).toBeNull(); expect(notice.content.textContent).toContain('<script>plain text</script>');
  const first = notice.content.querySelector('button'); first?.click(); expect(invoke).toHaveBeenCalledOnce();
  handle.update('Deutsch', [{ label: 'Öffnen', disabled: true, invoke }]); first?.click(); expect(invoke).toHaveBeenCalledOnce();
  const second = notice.content.querySelector('button'); expect(second?.disabled).toBe(true); expect(second?.textContent).toBe('Öffnen');
  handle.dismiss(); handle.dismiss(); handle.update('late', []); second?.click();
  expect(notice.hide).toHaveBeenCalledOnce(); expect(notice.setMessage).toHaveBeenCalledOnce(); expect(invoke).toHaveBeenCalledOnce();
});
it('[NTF-SINK-02] browser sink follows the same persistent/updated/action cleanup contract and unregisters its handle', () => {
  const owned = new Set<() => void>(); const invoke = vi.fn();
  const handle = browserNotification('<b>plain</b>', [{ label: 'Open', disabled: false, invoke }], close => { owned.add(close); return () => { owned.delete(close); }; });
  const first = document.querySelector('button'); first?.click(); expect(invoke).toHaveBeenCalledOnce(); expect(document.querySelector('b')).toBeNull();
  handle.update('updated', [{ label: 'Later', disabled: true, invoke }]); first?.click(); expect(invoke).toHaveBeenCalledOnce();
  expect(document.querySelector('[role="status"]')?.textContent).toBe('updatedLater');
  expect(document.querySelector('button')?.disabled).toBe(true); expect(owned.size).toBe(1);
  handle.dismiss(); handle.dismiss(); handle.update('late', []); expect(owned.size).toBe(0); expect(document.querySelector('[role="status"]')).toBeNull();
  const next = browserNotification('another', [], close => { owned.add(close); return () => { owned.delete(close); }; }); next.dismiss();
});
it('[NOTICE-SINK-01] notice helpers default to the real native sink and share owned policy updates/disposal', () => {
  const cancel = vi.fn(); const services = new NoticeService({ ...host(), kind: 'obsidian', notification: nativeNotification }, key => key,
    { report: vi.fn() }, { scheduler: { after: () => cancel } });
  const info = services.info({ owner: 'native-command', operation: 'one', key: 'hello' });
  expect(native.notices).toHaveLength(1); expect(native.notices[0]?.duration).toBe(0);
  const done = services.success({ owner: 'native-command', operation: 'one', key: 'saved' }); expect(done?.id).toBe(info?.id); expect(native.notices).toHaveLength(1);
  expect(native.notices[0]?.content.textContent).toBe('saved'); expect(native.notices[0]?.setMessage).toHaveBeenCalledOnce();
  services.warning({ owner: 'inline', operation: 'two', key: 'warning', native: false }); expect(native.notices).toHaveLength(1);
  services.dispose(); services.dispose(); expect(native.notices[0]?.hide).toHaveBeenCalledOnce(); expect(cancel).toHaveBeenCalledTimes(2);
});
