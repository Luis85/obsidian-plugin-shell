import { describe, it, expect, vi } from 'vitest';
import { TypedEventBus } from '../../src/infrastructure/events/typed-event-bus';
import { fixture } from './helpers';
describe('Typed event ownership', () => {
  it('[EVT-I01] preserves registration order and skips removed entries', () => {
    const { bus } = fixture(); const seen: number[] = []; let stop = () => {};
    bus.on('showcase.ping', () => { seen.push(1); stop(); bus.on('showcase.ping', () => { seen.push(3); }); });
    stop = bus.on('showcase.ping', () => { seen.push(2); });
    bus.publish({ type: 'showcase.ping', payload: { sequence: 1 } }); expect(seen).toEqual([1]);
    bus.publish({ type: 'showcase.ping', payload: { sequence: 2 } }); expect(seen).toEqual([1, 1, 3]);
  });
  it('[EVT-I02] removes once before nested publication', () => {
    const { bus } = fixture(); const once = vi.fn(() => bus.publish({ type: 'showcase.ping', payload: { sequence: 2 } }));
    bus.once('showcase.ping', once); bus.publish({ type: 'showcase.ping', payload: { sequence: 1 } }); expect(once).toHaveBeenCalledTimes(1); expect(bus.size).toBe(0);
  });
  it('[EVT-I03] observes thrown and rejected listeners while continuing dispatch', async () => {
    const { bus, errors } = fixture(); const last = vi.fn();
    bus.on('showcase.ping', () => { throw new Error('sync'); });
    bus.on('showcase.ping', async () => { throw new Error('async'); }); bus.on('showcase.ping', last);
    bus.publish({ type: 'showcase.ping', payload: { sequence: 1 } }); await Promise.resolve(); await Promise.resolve();
    expect(last).toHaveBeenCalledTimes(1); expect(errors.report).toHaveBeenCalledTimes(2);
  });
  it('[EVT-I04] isolates and deeply freezes payload snapshots', () => {
    const bus = new TypedEventBus<{ update: { values: number[] } }>({ report: vi.fn() });
    let received: readonly number[] = []; bus.on('update', payload => { received = payload.values; });
    const source = { values: [1] }; bus.publish({ type: 'update', payload: source }); source.values.push(2);
    expect(received).toEqual([1]); expect(Object.isFrozen(received)).toBe(true);
  });
  it('[EVT-I05] isolates instances and disposes without reviving subscriptions', () => {
    const a = fixture(); const b = fixture(); const listener = vi.fn(); const stop = a.bus.on('showcase.ping', listener);
    b.bus.publish({ type: 'showcase.ping', payload: { sequence: 1 } }); expect(listener).not.toHaveBeenCalled();
    stop(); stop(); expect(a.bus.size).toBe(0); a.bus.dispose(); a.bus.dispose();
    a.bus.publish({ type: 'showcase.ping', payload: { sequence: 1 } }); expect(listener).not.toHaveBeenCalled();
    expect(() => a.bus.on('showcase.ping', listener)).toThrow('BUS_DISPOSED');
  });
  it('[EVT-I06] bounds synchronous recursion', () => {
    const { bus, errors } = fixture(); bus.on('showcase.ping', () => bus.publish({ type: 'showcase.ping', payload: { sequence: 0 } }));
    bus.publish({ type: 'showcase.ping', payload: { sequence: 0 } }); expect(errors.report).toHaveBeenCalledExactlyOnceWith('event.recursion', 'event.dispatch');
  });
});
