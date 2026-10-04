import { describe, expect, it, vi } from 'vitest';
import { defineCommand, defineRibbon } from '../../src/features/api';
import { CommandService } from '../../src/application/command-service';
import { success, failure } from '../../src/domain/outcome';
import { deferred } from './helpers';

describe('Feature-owned command descriptors and dispatch', () => {
  it('[COMMAND-03-01] validates catalog identity, labels and actual ribbon references before effects', () => {
    const execute = vi.fn(); const command = defineCommand({ id: 'sample', titleKey: 'command.sample', execute });
    const ribbon = defineRibbon(command, { id: 'sample-button', icon: 'blocks' });
    const errors = { report: vi.fn() }; const options = { validKey: () => true };
    expect(() => new CommandService([{ commands: [command, command] }], errors, options)).toThrow('DUPLICATE_COMMAND_ID');
    expect(() => new CommandService([{ commands: [command], ribbons: [ribbon, ribbon] }], errors, options)).toThrow('DUPLICATE_RIBBON_ID');
    expect(() => new CommandService([{ commands: [], ribbons: [ribbon] }], errors, options)).toThrow('RIBBON_COMMAND_NOT_REGISTERED');
    const shadow = defineCommand({ id: 'sample', titleKey: 'command.sample', execute });
    expect(() => new CommandService([{ commands: [shadow], ribbons: [ribbon] }], errors, options)).toThrow('RIBBON_COMMAND_NOT_REGISTERED');
    expect(() => new CommandService([{ commands: [command] }], errors, { validKey: () => false })).toThrow('UNKNOWN_COMMAND_LABEL');
    expect(() => new CommandService([{ commands: [command], ribbons: [defineRibbon(command, { id: 'another', icon: 'blocks', titleKey: 'missing' })] }], errors, { validKey: key => key === command.titleKey })).toThrow('UNKNOWN_COMMAND_LABEL');
    for (const id of ['../bad', 'Upper', 'x'.repeat(65), '']) expect(() => defineCommand({ id, titleKey: 'command.sample', execute })).toThrow();
    expect(() => new CommandService([{ commands: Array.from({ length: 101 }, (_, index) => defineCommand({ id: `item-${index}`, titleKey: 'command.sample', execute })) }], errors, options)).toThrow('COMMAND_CATALOG_LIMIT');
    expect(() => new CommandService([{ commands: [command], ribbons: Array.from({ length: 101 }, (_, index) => defineRibbon(command, { id: `ribbon-${index}`, icon: 'blocks' })) }], errors, options)).toThrow('RIBBON_CATALOG_LIMIT');
    expect(() => defineRibbon(command, { id: 'sample', icon: '<unsafe>' })).toThrow();
    expect(() => defineCommand({ id: 'sample', titleKey: '', execute })).toThrow();
    expect(execute).not.toHaveBeenCalled();
  });
  it('[COMMAND-03-02] availability is a pure synchronous check and execution revalidates live conditions', async () => {
    const execute = vi.fn(); let enabled = false; const available = vi.fn(() => enabled);
    const command = defineCommand({ id: 'sample', titleKey: 'command.sample', execute, available });
    const service = new CommandService([{ commands: [command] }], { report: vi.fn() }, { validKey: () => true });
    expect(available).not.toHaveBeenCalled(); expect(service.available('sample')).toBe(false);
    expect((await service.execute('sample')).ok).toBe(false); expect(execute).not.toHaveBeenCalled();
    enabled = true; expect(service.available('sample')).toBe(true); expect(execute).not.toHaveBeenCalled();
    expect((await service.execute('sample')).ok).toBe(true); expect(execute).toHaveBeenCalledTimes(1);
    expect(service.available('unknown')).toBe(false); expect((await service.execute('unknown')).ok).toBe(false);
  });
  it('[COMMAND-03-03] palette/ribbon-equivalent submissions coalesce and pending checks do not execute again', async () => {
    const barrier = deferred(); const execute = vi.fn(() => barrier.promise);
    const service = new CommandService([{ commands: [defineCommand({ id: 'sample', titleKey: 'command.sample', execute })] }], { report: vi.fn() }, { validKey: () => true });
    const first = service.execute('sample'); const second = service.execute('sample');
    expect(first).toBe(second); expect(service.available('sample')).toBe(false);
    await Promise.resolve(); expect(execute).toHaveBeenCalledTimes(1); barrier.resolve();
    expect(await first).toEqual(success(undefined)); expect(service.available('sample')).toBe(true);
  });
  it('[COMMAND-03-04] sync/async exceptions, typed failures and feedback failure are observed without false success', async () => {
    const errors = { report: vi.fn() }; const observe = vi.fn(); const onFailure = vi.fn(async () => { throw new Error('sink private'); });
    const service = new CommandService([{ commands: [
      defineCommand({ id: 'sync', titleKey: 'command.sample', execute() { throw new Error('private path'); } }),
      defineCommand({ id: 'async', titleKey: 'command.sample', async execute() { throw new Error('private body'); } }),
      defineCommand({ id: 'typed', titleKey: 'command.sample', execute: () => failure('storage', 'error.write') }),
      defineCommand({ id: 'values', titleKey: 'command.sample', execute: () => success({ private: 'not emitted' }) }),
    ] }], errors, { validKey: () => true, observe, onFailure });
    expect(await service.execute('sync')).toMatchObject({ ok: false, error: { effect: 'uncertain' } });
    expect(await service.execute('async')).toMatchObject({ ok: false, error: { effect: 'uncertain' } });
    expect(await service.execute('typed')).toEqual(failure('storage', 'error.write'));
    expect(await service.execute('values')).toEqual(success(undefined));
    expect(errors.report.mock.calls.filter(call => call[0] === 'command.execute')).toHaveLength(2);
    expect(errors.report.mock.calls.filter(call => call[0] === 'command.feedback')).toHaveLength(3);
    expect(observe.mock.calls.map(([event]) => event.phase)).toEqual(['started', 'failed', 'started', 'failed', 'started', 'failed', 'started', 'completed']);
    expect(JSON.stringify(observe.mock.calls)).not.toContain('private');
  });
  it('[COMMAND-03-05] disposal blocks queued and retained callbacks without pretending to cancel a started effect', async () => {
    const execute = vi.fn(); const errors = { report: vi.fn() };
    const queued = new CommandService([{ commands: [defineCommand({ id: 'sample', titleKey: 'command.sample', execute })] }], errors, { validKey: () => true });
    const pending = queued.execute('sample'); queued.dispose();
    expect(await pending).toMatchObject({ ok: false, error: { code: 'disposed' } }); expect(execute).not.toHaveBeenCalled();
    expect((await queued.execute('sample')).ok).toBe(false); expect(queued.available('sample')).toBe(false);
    const barrier = deferred(); const observe = vi.fn(); const onFailure = vi.fn();
    const started = new CommandService([{ commands: [defineCommand({ id: 'pending', titleKey: 'command.sample', execute: () => barrier.promise })] }], errors, { validKey: () => true, observe, onFailure });
    const work = started.execute('pending'); await Promise.resolve(); started.dispose(); barrier.resolve();
    expect(await work).toEqual(success(undefined)); expect(observe).toHaveBeenCalledTimes(1); expect(onFailure).not.toHaveBeenCalled();
  });
  it('[COMMAND-03-06] unavailable checks and observer exceptions are contained independently', async () => {
    const errors = { report: vi.fn() }; const execute = vi.fn();
    const check = defineCommand({ id: 'check', titleKey: 'command.sample', execute, available() { throw new Error('private'); } });
    const service = new CommandService([{ commands: [check, defineCommand({ id: 'valid', titleKey: 'command.sample', execute })] }], errors, { validKey: () => true, observe() { throw new Error('observer'); } });
    expect(service.available('check')).toBe(false); expect(execute).not.toHaveBeenCalled();
    expect(await service.execute('valid')).toEqual(success(undefined));
    expect(errors.report.mock.calls).toEqual([['command.availability', 'command.check'], ['command.observer', 'command.observe'], ['command.observer', 'command.observe']]);
  });
  it('[COMMAND-03-07] failure projection retains effects while excluding raw causes and unregistered messages', async () => {
    const errors = { report: vi.fn() }; const onFailure = vi.fn();
    const error = { code: 'storage' as const, key: 'error.write', effect: 'committed' as const, field: 'title', cause: 'private note path and body' };
    const service = new CommandService([{ commands: [
      defineCommand({ id: 'safe', titleKey: 'command.sample', execute: () => ({ ok: false as const, error }) }),
      defineCommand({ id: 'unsafe', titleKey: 'command.sample', execute: () => ({ ok: false as const, error: { ...error, key: 'private note text', effect: 'uncertain' as const, field: '../private' } }) }),
    ] }], errors, { validKey: key => ['command.sample', 'error.write'].includes(key), onFailure });
    expect(await service.execute('safe')).toEqual({ ok: false, error: { code: 'storage', key: 'error.write', effect: 'committed', field: 'title' } });
    expect(await service.execute('unsafe')).toEqual({ ok: false, error: { code: 'storage', key: 'error.unexpected', effect: 'uncertain' } });
    expect(JSON.stringify(onFailure.mock.calls)).not.toContain('private');
    expect(errors.report).toHaveBeenCalledExactlyOnceWith('command.result', 'command.execute');
  });
  it('[COMMAND-03-08] asynchronous observers and invalid JavaScript callbacks cannot leak unhandled promises', async () => {
    const errors = { report: vi.fn() }; const execute = vi.fn();
    const asyncCheck = Reflect.apply(defineCommand, undefined, [{ id: 'async-check', titleKey: 'command.sample', execute, available: async () => { throw new Error('invalid asynchronous query'); } }]);
    const malformed = Reflect.apply(defineCommand, undefined, [{ id: 'malformed', titleKey: 'command.sample', execute: () => 'private invalid return' }]);
    const invalidCheck = Reflect.apply(defineCommand, undefined, [{ id: 'invalid-check', titleKey: 'command.sample', execute, available: () => 'yes' }]);
    const service = new CommandService([{ commands: [asyncCheck, malformed, invalidCheck, defineCommand({ id: 'valid', titleKey: 'command.sample', execute })] }], errors, {
      validKey: () => true, async observe() { throw new Error('observer'); },
    });
    expect(service.available('async-check')).toBe(false); expect(service.available('invalid-check')).toBe(false);
    expect(await service.execute('malformed')).toMatchObject({ ok: false, error: { effect: 'uncertain' } });
    expect(await service.execute('valid')).toEqual(success(undefined)); await Promise.resolve();
    expect(errors.report.mock.calls.filter(call => call[0] === 'command.availability')).toHaveLength(2);
    expect(errors.report.mock.calls.filter(call => call[0] === 'command.observer')).toHaveLength(4);
    expect(errors.report.mock.calls.filter(call => call[0] === 'command.result')).toHaveLength(1);
  });
  it('[COMMAND-03-09] availability changes before queued execution prevent starting the action', async () => {
    let enabled = true; const execute = vi.fn(); const observe = vi.fn();
    const service = new CommandService([{ commands: [defineCommand({ id: 'sample', titleKey: 'command.sample', available: () => enabled, execute })] }], { report: vi.fn() }, { validKey: () => true, observe });
    const queued = service.execute('sample'); enabled = false;
    expect(await queued).toMatchObject({ ok: false, error: { key: 'error.commandUnavailable', effect: 'none' } });
    expect(execute).not.toHaveBeenCalled(); expect(observe).not.toHaveBeenCalled();
  });
  it('[COMMAND-03-10] teardown from a started observer prevents the action from beginning', async () => {
    let close: () => void = () => {}; const execute = vi.fn();
    const service = new CommandService([{ commands: [defineCommand({ id: 'sample', titleKey: 'command.sample', execute })] }], { report: vi.fn() }, {
      validKey: () => true, observe: event => { if (event.phase === 'started') close(); },
    });
    close = () => service.dispose();
    expect(await service.execute('sample')).toMatchObject({ ok: false, error: { code: 'disposed' } });
    expect(execute).not.toHaveBeenCalled();
    const query = new CommandService([{ commands: [defineCommand({ id: 'query', titleKey: 'command.sample', execute, available: () => { close(); return true; } })] }], { report: vi.fn() }, { validKey: () => true });
    close = () => query.dispose(); expect(query.available('query')).toBe(false);
    const feedback = vi.fn();
    const failed = new CommandService([{ commands: [defineCommand({ id: 'failure', titleKey: 'command.sample', execute: () => failure('storage', 'error.write') })] }], { report: vi.fn() }, {
      validKey: () => true, observe: event => { if (event.phase === 'failed') close(); }, onFailure: feedback,
    });
    close = () => failed.dispose(); expect((await failed.execute('failure')).ok).toBe(false); expect(feedback).not.toHaveBeenCalled();
  });
  it('[COMMAND-03-11] accessor-backed outcomes are rejected without rereading or forwarding private values', async () => {
    let reads = 0; const errors = { report: vi.fn() }; const onFailure = vi.fn();
    const accessorResult = Reflect.apply(defineCommand, undefined, [{ id: 'accessor', titleKey: 'command.sample', execute: () => ({ ok: false, error: {
      get code() { reads++; return reads < 3 ? 'storage' : 'private.secret'; }, key: 'error.unexpected',
      get effect() { reads++; return reads < 3 ? 'uncertain' : 'SECRET'; },
    } }) }]);
    const outerAccessor = Reflect.apply(defineCommand, undefined, [{ id: 'outer', titleKey: 'command.sample', execute: () => ({ get ok() { reads++; return true; } }) }]);
    const service = new CommandService([{ commands: [accessorResult, outerAccessor] }], errors, { validKey: () => true, onFailure });
    for (const id of ['accessor', 'outer']) expect(await service.execute(id)).toEqual({ ok: false, error: { code: 'unexpected', key: 'error.unexpected', effect: 'uncertain' } });
    expect(reads).toBe(0); expect(JSON.stringify(onFailure.mock.calls)).not.toMatch(/private|SECRET/);
    expect(errors.report.mock.calls).toEqual([['command.result', 'command.execute'], ['command.result', 'command.execute']]);
  });
});
