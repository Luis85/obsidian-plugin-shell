import { describe, it, expect, vi } from 'vitest';
import { NotificationService } from '../../src/application/notification-service';
import { Diagnostics } from '../../src/infrastructure/diagnostics';
import { fixture, host } from './helpers';
describe('Feedback and diagnostics', () => {
  it('[NTF-I01] replaces only one owner and keeps bounded entries', () => {
    const f = fixture(); const service = new NotificationService(host(), key => key, f.errors);
    service.show('a', 'info', 'first'); service.show('b', 'info', 'other'); service.show('a', 'success', 'done');
    expect(service.current.map(v => v.key)).toEqual(['other', 'done']);
    for (let i = 0; i < 20; i++) service.show(`owner${i}`, 'info', 'key'); expect(service.current).toHaveLength(5);
  });
  it('[NTF-I02] cleans native handles and ownership idempotently', () => {
    const h = host(); const hide = vi.fn(); vi.mocked(h.notice).mockReturnValue(hide); const f = fixture();
    const service = new NotificationService(h, key => key, f.errors); const id = service.show('a', 'info', 'key', true);
    expect(h.notice).toHaveBeenCalledExactlyOnceWith('key', 4000); service.dismiss(id); service.dismiss(id); expect(hide).toHaveBeenCalledTimes(1);
    service.show('b', 'success', 'key', true); service.dispose(); expect(hide).toHaveBeenCalledTimes(2); expect(service.current).toEqual([]);
  });
  it('[NTF-I03] sink errors are contained and observed', () => {
    const f = fixture(); const h = host(); vi.mocked(h.notice).mockImplementation(() => { throw new Error('sink'); });
    const service = new NotificationService(h, key => key, f.errors); expect(() => service.show('owner', 'info', 'key', true)).not.toThrow();
    expect(f.errors.report).toHaveBeenCalledWith('notice.sink', 'notice.show');
  });
  it('[NTF-I04] disposed feedback cannot revive native handles or subscriptions', () => {
    const f = fixture(); const h = host(); const service = new NotificationService(h, key => key, f.errors);
    const listener = vi.fn(); const stop = service.subscribe(listener);
    service.show('a', 'info', 'first'); expect(listener).toHaveBeenCalled(); stop();
    service.dispose(); service.dispose(); service.subscribe(listener); listener.mockClear();
    expect(service.show('late', 'error', 'key', true)).toBe(-1);
    expect(service.current).toEqual([]); expect(h.notice).not.toHaveBeenCalled(); expect(listener).not.toHaveBeenCalled();
  });
  it('[LOG-I01] diagnostics are bounded and strip unsafe fields before observation', () => {
    const observe = vi.fn(); const log = new Diagnostics(observe);
    for (let i = 0; i < 210; i++) log.report('error.safe', 'operation.safe');
    expect(log.current).toHaveLength(200); expect(observe).toHaveBeenCalledTimes(210);
    log.report('secret path / private note', 'https://secret'); expect(JSON.stringify(log.current.at(-1))).not.toContain('private');
    log.dispose();
  });
});
