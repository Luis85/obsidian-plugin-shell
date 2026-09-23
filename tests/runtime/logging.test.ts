import { describe, expect, it, vi } from 'vitest';
import { StructuredLogger } from '../../src/application/logging';
import { defineLogCatalog } from '../../src/features/api';
import { DebugService } from '../../src/application/debug-service';
import { Diagnostics } from '../../src/infrastructure/diagnostics';
import { deferred } from './helpers';
const now = () => '2026-09-23T00:00:00.000Z';
function fixture(capacity = 3) {
  const observed = vi.fn(); const diagnostics = new Diagnostics(observed); const sink = vi.fn();
  const logger = new StructuredLogger(diagnostics, now, { capacity, observe: sink });
  return { logger, diagnostics, observed, sink, debugging: new DebugService(logger, () => diagnostics.current) };
}
function compileContract(logger: StructuredLogger) {
  const author = logger.registerCatalog(defineLogCatalog('meetings', { codes: ['created', 'failed'], operations: ['create', 'open'] }));
  author.info('created', 'create', { count: 1, effect: 'committed' });
  // @ts-expect-error Undeclared log codes cannot become arbitrary user strings.
  author.info('note-title', 'create');
  // @ts-expect-error Registered operation names remain correlated to the catalog.
  author.warn('failed', 'unknown');
  // @ts-expect-error Sensitive strings are absent from the metadata contract.
  author.error('failed', 'open', { path: 'Notes/private.md' });
  // @ts-expect-error Correlations are issued by the logger rather than arbitrary strings.
  logger.info('operation.completed', 'command.execute', { correlation: 'private-title' });
}
void compileContract;
describe('Structured logging and explicit debugging', () => {
  it('[LOG-03-01] defaults to info, enables debug explicitly, and filters levels without disabling diagnostic evidence', () => {
    const f = fixture(); expect(f.debugging.enabled).toBe(false);
    expect(f.logger.debug('operation.started', 'command.execute')).toBe(false);
    expect(f.logger.info('runtime.started', 'runtime.initialize')).toBe(true);
    expect(f.logger.info('operation.completed', 'command.execute', { effect: undefined })).toBe(true);
    f.logger.setLevel('warn'); expect(f.logger.info('runtime.started', 'runtime.initialize')).toBe(false);
    expect(f.logger.warn('operation.failed', 'modal.open', { effect: 'none' })).toBe(true);
    expect(f.logger.error('operation.failed', 'document.create', { effect: 'uncertain' })).toBe(true);
    f.logger.setLevel('off'); f.diagnostics.report('document.write', 'document.create'); f.diagnostics.report('document.write', 'document.create');
    expect(f.observed).toHaveBeenCalledTimes(2); expect(f.logger.error('operation.failed', 'document.create')).toBe(false);
    f.debugging.setEnabled(true); expect(f.debugging.enabled).toBe(true); expect(f.logger.debug('operation.started', 'command.execute')).toBe(true);
    f.debugging.setEnabled(false); expect(f.logger.level).toBe('info'); f.logger.dispose(); f.diagnostics.dispose();
  });
  it('[LOG-03-02] bounds immutable records, reports dropped/cleared counts and scopes exported subsets explicitly', () => {
    const f = fixture(2); const correlation = f.logger.correlation();
    for (let count = 0; count < 4; count++) f.logger.info('operation.completed', 'command.execute', { count, correlation, durationMs: 1.5, attempt: 1, effect: 'committed' });
    expect(f.logger.current.map(entry => entry.sequence)).toEqual([3, 4]); expect(f.logger.statistics.dropped).toBe(2);
    expect(f.logger.current[0]?.metadata.correlation).toBe(1); expect(Object.isFrozen(f.logger.current[0]?.metadata)).toBe(true);
    const snapshot = f.debugging.snapshot(1); expect(snapshot.recordScope).toEqual({ retained: 2, exported: 1, omitted: 1 });
    expect(snapshot.logs[0]?.sequence).toBe(4); expect(snapshot.scope).toBe('runtime-debugging');
    expect(JSON.parse(f.debugging.exportJSON({ maxRecords: 0 })).logs).toEqual([]);
    expect(() => f.debugging.snapshot(-1)).toThrow('INVALID_DEBUG_EXPORT_LIMIT');
    f.logger.clear(); expect(f.logger.current).toEqual([]); expect(f.logger.statistics).toMatchObject({ dropped: 2, cleared: 1 });
    f.logger.dispose(); f.diagnostics.dispose();
  });
  it('[LOG-03-03] rejects getters, prototypes, circular data, raw causes and unissued correlations without reading payloads', () => {
    const f = fixture(20); const getter = vi.fn(() => 'SECRET'); const accessor = Object.defineProperty({}, 'count', { enumerable: true, get: getter });
    const circular: Record<string, unknown> = {}; circular.cause = circular;
    const symbol = { [Symbol('private')]: 'SECRET' };
    const trapped = new Proxy({}, { getPrototypeOf() { throw 'SECRET'; } });
    const unsupported = [accessor, circular, symbol, trapped, Object.create({ count: 1 }), new Error('SECRET'), 'SECRET', null, { title: 'SECRET' }, { path: 'Notes/SECRET' }, { count: Infinity }, { count: -1 }, { count: 0.5 }, { durationMs: 86_400_001 }, { effect: 'SECRET' }, { correlation: {} }];
    for (const metadata of unsupported) expect(Reflect.apply(f.logger.error, f.logger, ['operation.failed', 'command.execute', metadata])).toBe(false);
    expect(getter).not.toHaveBeenCalled(); expect(f.logger.current).toEqual([]); expect(f.observed).toHaveBeenCalledTimes(unsupported.length);
    const elsewhere = fixture(); expect(f.logger.info('operation.completed', 'command.execute', { correlation: elsewhere.logger.correlation() })).toBe(false);
    expect(Reflect.apply(f.logger.info, f.logger, ['SECRET', 'command.execute'])).toBe(false);
    expect(Reflect.apply(f.logger.info, f.logger, ['operation.completed', 'SECRET'])).toBe(false);
    expect(f.debugging.exportJSON()).not.toContain('SECRET'); expect(f.debugging.exportJSON()).not.toContain('Notes/');
    elsewhere.logger.dispose(); elsewhere.diagnostics.dispose(); f.logger.dispose(); f.diagnostics.dispose();
  });
  it('[LOG-03-04] observes sink/listener/clock failures independently, including non-Error throws, without recursion', async () => {
    const errors = { report: vi.fn() }; const logger = new StructuredLogger(errors, () => { throw { private: 'SECRET' }; }, { observe() { throw 'SECRET'; } });
    const off = logger.subscribe(() => { throw new Error('SECRET'); }); const offAsync = logger.subscribe(async () => { throw null; });
    expect(logger.error('operation.failed', 'command.execute')).toBe(true); await Promise.resolve();
    expect(logger.current[0]?.timestamp).toBeNull(); expect(errors.report.mock.calls).toEqual([
      ['logging.clock', 'logging.record'], ['logging.observer', 'logging.observe'], ['logging.listener', 'logging.notify'], ['logging.listener', 'logging.notify'],
    ]);
    off(); offAsync(); logger.dispose();
    const broken = new StructuredLogger({ report() { throw new Error('reporter'); } }, () => 'SECRET', { observe() { throw 'sink'; } });
    expect(() => broken.error('operation.failed', 'command.execute')).not.toThrow(); expect(broken.current[0]?.timestamp).toBeNull(); broken.dispose();
  });
  it('[LOG-03-05] feature catalogs retain literal contracts, snapshots and duplicate protection without core edits', () => {
    const f = fixture(); const codes = ['created']; const operations = ['create']; const catalog = defineLogCatalog('meeting', { codes, operations });
    codes.push('unreviewed'); operations.push('unreviewed'); const feature = f.logger.registerCatalog(catalog);
    expect(feature.info('created', 'create', { count: 1 })).toBe(true);
    expect(feature.info('unreviewed', 'create')).toBe(false); expect(f.logger.current[0]).toMatchObject({ code: 'meeting.created', operation: 'meeting.create' });
    expect(() => f.logger.registerCatalog(catalog)).toThrow('LOG_CATALOG_CONFLICT');
    for (const bad of [() => defineLogCatalog('../secret', { codes: ['x'], operations: ['y'] }), () => defineLogCatalog('scope', { codes: [], operations: ['y'] }), () => defineLogCatalog('scope', { codes: ['x', 'x'], operations: ['y'] })]) expect(bad).toThrow('INVALID_LOG_CATALOG');
    expect(() => new StructuredLogger(f.diagnostics, now, { capacity: 0 })).toThrow('INVALID_LOG_CAPACITY');
    const longCommands = f.logger.registerCatalog(defineLogCatalog('commands', { codes: ['started'], operations: ['a'.repeat(80)] }));
    expect(longCommands.info('started', 'a'.repeat(80))).toBe(true);
    f.logger.dispose(); expect(feature.info('created', 'create')).toBe(false); expect(() => f.logger.correlation()).toThrow('LOGGER_DISPOSED');
    expect(() => f.logger.registerCatalog(defineLogCatalog('late', { codes: ['x'], operations: ['y'] }))).toThrow('LOG_CATALOG_CONFLICT'); f.diagnostics.dispose();
  });
  it('[LOG-03-06] disposal clears owned records/listeners and export never serializes raw diagnostic text', () => {
    const f = fixture(); const changed = vi.fn(); f.logger.subscribe(changed);
    f.logger.info('runtime.started', 'runtime.initialize'); f.diagnostics.report('secretpath', 'secrettitle');
    const exported = f.debugging.exportJSON(); expect(exported).not.toContain('secretpath'); expect(exported).not.toContain('secrettitle');
    expect(JSON.parse(exported).diagnostics).toEqual({ retained: 1, observed: 1 });
    f.logger.dispose(); const calls = changed.mock.calls.length; f.logger.setLevel('debug'); f.logger.clear(); f.logger.subscribe(changed)();
    expect(f.logger.info('runtime.started', 'runtime.initialize')).toBe(false); expect(f.logger.current).toEqual([]); expect(changed).toHaveBeenCalledTimes(calls);
    f.logger.dispose(); f.diagnostics.dispose();
  });
  it('[LOG-03-07] reporter, observer and listener reentry is bounded and later independent logging still works', async () => {
    let nested: StructuredLogger | undefined;
    const reporter = { report: vi.fn(() => { nested?.error('operation.failed', 'command.execute'); }) };
    const logger = new StructuredLogger(reporter, () => 'invalid clock'); nested = logger;
    expect(logger.error('operation.failed', 'command.execute')).toBe(true); expect(reporter.report).toHaveBeenCalledOnce();
    expect(logger.current).toHaveLength(1); expect(logger.statistics.reentrant).toBe(1); logger.dispose();
    const diagnostics = new Diagnostics(); let observed: StructuredLogger | undefined;
    const value = new StructuredLogger(diagnostics, now, { observe: () => { observed?.info('operation.completed', 'command.execute'); } }); observed = value;
    const off = value.subscribe(() => { value.info('operation.completed', 'command.execute'); value.setLevel('debug'); value.clear(); });
    value.info('runtime.started', 'runtime.initialize'); expect(value.current).toHaveLength(1); expect(value.level).toBe('info');
    expect(value.statistics.reentrant).toBe(4); off();
    const asyncOff = value.subscribe(async () => { await Promise.resolve(); value.info('operation.completed', 'command.execute'); });
    value.info('operation.completed', 'command.execute'); await Promise.resolve(); await Promise.resolve(); asyncOff();
    const before = value.current.length; expect(value.info('operation.completed', 'command.execute')).toBe(true); expect(value.current.length).toBe(before + 1);
    expect(value.statistics.reentrant).toBeGreaterThan(4); value.dispose(); diagnostics.dispose();
  });
  it('[LOG-03-08] an asynchronous observer rejection remains observable after delivery and cannot restart logging', async () => {
    const errors = { report: vi.fn() }; let logger: StructuredLogger | undefined;
    const instance = new StructuredLogger(errors, now, { observe: async () => { await Promise.resolve(); logger?.info('runtime.started', 'runtime.initialize'); throw new Error('private'); } }); logger = instance;
    instance.info('runtime.started', 'runtime.initialize'); await Promise.resolve(); await Promise.resolve();
    expect(instance.current).toHaveLength(2); expect(instance.statistics.deliverySkipped).toBe(1); expect(instance.statistics.reentrant).toBe(0);
    expect(errors.report).toHaveBeenCalledExactlyOnceWith('logging.observer', 'logging.observe'); instance.dispose();
  });
  it('[LOG-03-09] disposal during a reporter callback cannot append late records', () => {
    let logger: StructuredLogger | undefined;
    const instance = new StructuredLogger({ report() { logger?.dispose(); } }, () => 'invalid'); logger = instance;
    expect(instance.error('operation.failed', 'command.execute')).toBe(false); expect(instance.current).toEqual([]);
  });
  it('[LOG-03-10] a pending subscriber never suppresses independent records, level changes or clearing', async () => {
    const f = fixture(10); const barrier = deferred(); const listener = vi.fn(async () => { await barrier.promise; });
    const off = f.logger.subscribe(listener);
    expect(f.logger.info('operation.started', 'command.execute')).toBe(true);
    expect(f.logger.error('operation.failed', 'document.create', { effect: 'uncertain' })).toBe(true);
    expect(f.logger.current.map(record => record.level)).toEqual(['info', 'error']); expect(listener).toHaveBeenCalledOnce();
    f.logger.setLevel('debug'); expect(f.logger.level).toBe('debug'); f.logger.clear(); expect(f.logger.current).toEqual([]);
    expect(f.logger.debug('operation.started', 'command.execute')).toBe(true);
    expect(f.logger.statistics.reentrant).toBe(0); expect(f.logger.statistics.deliverySkipped).toBeGreaterThan(0);
    barrier.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(f.logger.info('operation.completed', 'command.execute')).toBe(true); expect(listener).toHaveBeenCalledTimes(2);
    off(); f.logger.dispose(); f.diagnostics.dispose();
  });
  it('[LOG-03-11] exported build attribution is a validated immutable public snapshot without private metadata', () => {
    const f = fixture(); const metadata: { id: string; version: string; host: 'browser' | 'obsidian' } = { id: 'field-notes', version: '1.0.0', host: 'browser' };
    const debugging = new DebugService(f.logger, () => f.diagnostics.current, metadata);
    metadata.id = 'changed'; metadata.version = '2.0.0'; metadata.host = 'obsidian';
    expect(debugging.snapshot().identity).toEqual({ id: 'field-notes', version: '1.0.0', host: 'browser' });
    expect(Object.isFrozen(debugging.snapshot().identity)).toBe(true);
    const getter = vi.fn(() => 'SECRET'); const accessor = Object.defineProperty({ version: '1.0.0', host: 'browser' }, 'id', { enumerable: true, get: getter });
    for (const invalid of [accessor, null, [], { id: '../SECRET', version: '1.0.0', host: 'browser' }, { id: 'valid', version: 'SECRET', host: 'browser' }, { id: 'valid', version: '1.0.0', host: 'SECRET' }, { ...metadata, author: 'SECRET' }, { ...metadata, repository: 'SECRET' }, { ...metadata, path: 'SECRET' }]) {
      expect(() => Reflect.construct(DebugService, [f.logger, () => [], invalid])).toThrow('INVALID_DEBUG_IDENTITY');
    }
    expect(getter).not.toHaveBeenCalled(); expect(debugging.exportJSON()).not.toContain('SECRET');
    expect(f.debugging.snapshot().identity).toBeUndefined(); f.logger.dispose(); f.diagnostics.dispose();
  });
});
