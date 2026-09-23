import { describe, expect, it, vi } from 'vitest';
import { composeEvents, defineEvent } from '../../src/application/event-definition';
import { runtimeEventDefinitions } from '../../src/bootstrap/events';
import { coreEvents } from '../../src/application/event-definitions/core';
import { eventCatalog } from '../../src/bootstrap/event-catalog';
import { TypedEventBus } from '../../src/infrastructure/events/typed-event-bus';
import type { ShellEvents } from '../../src/application/events';

const created = defineEvent(
  'bookmarks.created',
  (value: unknown): value is { readonly id: string } =>
    typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string',
);
describe('Registered event authoring', () => {
  it('gives observers no publication or acquisition method and scopes publishers to registered descriptors', () => {
    const errors = { report: vi.fn() };
    const bus = new TypedEventBus<ShellEvents>(errors, [...coreEvents, created]);
    const observer = bus.observer();
    const publisher = bus.publisher(created);
    const received: string[] = [];
    const stop = bus.subscriber(created).on((payload) => {
      received.push(payload.id);
    });
    expect('publish' in observer).toBe(false);
    expect('publisher' in observer).toBe(false);
    expect(observer.size).toBe(1);
    publisher.publish({ type: 'bookmarks.created', payload: { id: 'one' } });
    expect(received).toEqual(['one']);
    stop();
    stop();
    expect(observer.size).toBe(0);
    observer.once('preferences.changed', () => {
      received.push('ping');
    });
    bus.publish({ type: 'preferences.changed', payload: { revision: 1 } });
    bus.publish({ type: 'preferences.changed', payload: { revision: 2 } });
    expect(received).toEqual(['one', 'ping']);
    Reflect.apply(publisher.publish, undefined, [{ type: 'documents.created', payload: {} }]);
    Reflect.apply(publisher.publish, undefined, [{ type: 'bookmarks.created', payload: { id: false } }]);
    expect(errors.report).toHaveBeenCalledTimes(2);
    const impostor = defineEvent(created.id, created.valid);
    expect(() => bus.publisher(impostor)).toThrow('EVENT_UNREGISTERED_REFERENCE');
    expect(() => bus.subscriber(impostor)).toThrow('EVENT_UNREGISTERED_REFERENCE');
    bus.dispose();
    publisher.publish({ type: 'bookmarks.created', payload: { id: 'late' } });
    expect(() => bus.subscriber(created).on(() => undefined)).toThrow('BUS_DISPOSED');
  });
  it('rejects duplicate names including identical shape and malformed names', () => {
    expect(() => composeEvents([created], [defineEvent(created.id, created.valid)])).toThrow('EVENT_DUPLICATE');
    expect(() => composeEvents([defineEvent('invalid', created.valid)])).toThrow('EVENT_INVALID_DEFINITION');
    expect(() => composeEvents([defineEvent('Bad.fact', created.valid)])).toThrow('EVENT_INVALID_DEFINITION');
    expect(() => Reflect.apply(composeEvents, undefined, [[{ id: 'valid.name', valid: null }]])).toThrow(
      'EVENT_INVALID_DEFINITION',
    );
  });
  it('retains real bus error isolation and cleanup for descriptor subscribers', async () => {
    const errors = { report: vi.fn() };
    const bus = new TypedEventBus(errors, [created]);
    const stop = bus.subscriber(created).on(async () => {
      throw new Error('listener');
    });
    const second = vi.fn();
    bus.observe(created, second);
    bus.publisher(created).publish({ type: 'bookmarks.created', payload: { id: 'saved' } });
    await Promise.resolve();
    await Promise.resolve();
    expect(second).toHaveBeenCalledExactlyOnceWith({ id: 'saved' });
    expect(errors.report).toHaveBeenCalledExactlyOnceWith('event.listener', 'event.dispatch');
    stop();
    bus.dispose();
    expect(bus.size).toBe(0);
  });
  it('removes scoped once subscriptions before reentrant publication and validates the delivered clone', () => {
    const errors = { report: vi.fn() };
    const bus = new TypedEventBus<ShellEvents>(errors, [...coreEvents, created]);
    const publisher = bus.publisher(created);
    const once = vi.fn(() => publisher.publish({ type: created.id, payload: { id: 'nested' } }));
    bus.subscriber(created).once(once);
    publisher.publish({ type: created.id, payload: { id: 'outer' } });
    expect(once).toHaveBeenCalledTimes(1);
    expect(bus.size).toBe(0);
    const received = vi.fn();
    bus.on('plugin-data.created', received);
    let reads = 0;
    const payload = {
      entity: 'item',
      get id() {
        return ++reads === 1 ? 'valid' : 42;
      },
      schemaVersion: 1,
      revision: 1,
    };
    Reflect.apply(bus.publish, bus, [{ type: 'plugin-data.created', payload }]);
    expect(received).toHaveBeenCalledExactlyOnceWith({
      entity: 'item',
      id: 'valid',
      schemaVersion: 1,
      revision: 1,
    });
    Reflect.apply(bus.publish, bus, [{ type: 'unknown.name', payload: {} }]);
    Reflect.apply(bus.publish, bus, [{ type: Symbol('invalid'), payload: {} }]);
    Reflect.apply(bus.publish, bus, [
      {
        type: 'plugin-data.created',
        payload: {
          get id() {
            throw new Error('getter');
          },
        },
      },
    ]);
    expect(errors.report).toHaveBeenCalledTimes(3);
    bus.dispose();
  });
  it('documents every registered descriptor and validates actual boundary payloads', () => {
    expect(eventCatalog.map((entry) => entry.definition)).toEqual(runtimeEventDefinitions);
    const examples: Record<string, Record<string, unknown>> = {
      'plugin-data.created': {
        entity: 'item',
        id: 'id',
        schemaVersion: 1,
        revision: 1,
      },
      'plugin-data.updated': {
        entity: 'item',
        id: 'id',
        schemaVersion: 1,
        revision: 2,
      },
      'plugin-data.deleted': {
        entity: 'item',
        id: 'id',
        schemaVersion: 1,
        revision: 3,
      },
      'documents.created': {
        entity: 'task',
        id: 'id',
        schemaVersion: 1,
        path: 'Tasks/One.md',
      },
      'documents.updated': {
        entity: 'task',
        id: 'id',
        schemaVersion: 1,
        path: 'Tasks/One.md',
      },
      'documents.deleted': {
        entity: 'task',
        id: 'id',
        schemaVersion: 1,
        path: 'Tasks/One.md',
      },
      'preferences.changed': { revision: 1 },
      'showcase.ping': { sequence: 1 },
      'host.active-file-changed': { available: false },
      'host.vault.entry-created': { path: 'Tasks', kind: 'folder' },
      'host.vault.entry-modified': { path: 'Tasks/One.md', modifiedTime: 3 },
      'host.vault.entry-renamed': {
        path: 'Tasks/Two.md',
        oldPath: 'Tasks/One.md',
        kind: 'file',
      },
      'host.vault.entry-deleted': { path: 'Tasks/Two.md', kind: 'file' },
      'host.workspace.file-opened': { path: 'Tasks/One.md' },
      'host.workspace.active-view-changed': { viewType: 'markdown' },
      'host.workspace.layout-changed': { revision: 1 },
      'host.metadata.changed': { path: 'Tasks/One.md' },
    };
    for (const definition of runtimeEventDefinitions.filter((definition) => Object.hasOwn(examples, definition.id))) {
      const payload = examples[definition.id];
      if (!payload) throw new Error('Missing event fixture');
      expect(definition.valid(payload), definition.id).toBe(true);
      for (const invalid of [null, false, [], {}, new Date(), { ...payload, unexpected: true }])
        expect(definition.valid(invalid), definition.id).toBe(false);
      for (const key of Object.keys(payload)) {
        for (const invalid of [undefined, {}, [], -1, Infinity, 0.5, '', 'invalid']) {
          const candidate = { ...payload, [key]: invalid };
          if (key === 'viewType' && invalid === '') continue;
          if (typeof invalid === 'string' && typeof payload[key] === 'string' && invalid.length && key !== 'kind')
            continue;
          expect(definition.valid(candidate), `${definition.id}:${key}:${String(invalid)}`).toBe(false);
        }
        expect(definition.valid({ ...payload, [key]: null }), definition.id).toBe(
          ['modifiedTime', 'viewType'].includes(key) ||
            (definition.id === 'host.workspace.file-opened' && key === 'path'),
        );
      }
    }
  });
});
