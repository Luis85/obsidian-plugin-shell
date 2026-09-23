// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('obsidian', async () => (await import('./host-fixture')).hostModule);
import { App, Plugin } from 'obsidian';
import { CommandService } from '../../src/application/command-service';
import { defineCommand, defineRibbon } from '../../src/features/api';
import { bindCommands } from '../../src/infrastructure/obsidian/commands';
import { hostState } from './host-fixture';
import { deferred } from './helpers';
import manifest from '../../manifest.json';
class FixturePlugin extends Plugin {}

beforeEach(() => { hostState.reset(); document.body.replaceChildren(); });
describe('Native command and ribbon boundary', () => {
  it('[COMMAND-HOST-01] checking has no effects and palette/ribbon dispatch share single-flight ownership', async () => {
    const plugin = new FixturePlugin(new App(), manifest); const errors = { report: vi.fn() };
    const barrier = deferred(); const execute = vi.fn(() => barrier.promise); let enabled = true;
    const command = defineCommand({ id: 'example', titleKey: 'command.example', available: () => enabled, execute });
    const service = new CommandService([{ commands: [command], ribbons: [defineRibbon(command, { id: 'ribbon', icon: 'blocks' })] }], errors, { validKey: () => true });
    const stop = bindCommands(plugin, service, key => `localized:${key}`, errors);
    const registered = hostState.commands.get('example'); const ribbon = hostState.ribbons[0];
    expect(registered?.id).toBe(`${manifest.id}:example`);
    expect(registered?.name).toBe(`${manifest.name}: localized:command.example`); expect(ribbon?.title).toBe('localized:command.example');
    expect(registered?.checkCallback?.(true)).toBe(true); expect(execute).not.toHaveBeenCalled();
    registered?.checkCallback?.(false); ribbon?.callback(new MouseEvent('click')); await Promise.resolve();
    expect(execute).toHaveBeenCalledTimes(1); expect(registered?.checkCallback?.(true)).toBe(false);
    barrier.resolve(); await service.execute('example'); enabled = false;
    expect(registered?.checkCallback?.(false)).toBe(false); expect(execute).toHaveBeenCalledTimes(1);
    stop(); stop(); expect(ribbon?.element.isConnected).toBe(false); expect(plugin.removeCommand).toHaveBeenCalledExactlyOnceWith('example');
    expect(hostState.commands.size).toBe(0);
    registered?.callback?.(); ribbon?.callback(new MouseEvent('click')); await Promise.resolve(); expect(execute).toHaveBeenCalledTimes(1);
  });
  it('[COMMAND-HOST-02] partial host registration failure rolls back owned commands and leaves callbacks inert', async () => {
    const plugin = new FixturePlugin(new App(), manifest); const errors = { report: vi.fn() }; const execute = vi.fn();
    const command = defineCommand({ id: 'example', titleKey: 'command.example', execute });
    const service = new CommandService([{ commands: [command], ribbons: [defineRibbon(command, { id: 'ribbon', icon: 'blocks' })] }], errors, { validKey: () => true });
    vi.mocked(plugin.addRibbonIcon).mockImplementationOnce(() => { throw new Error('host failed'); });
    expect(() => bindCommands(plugin, service, key => key, errors)).toThrow('host failed');
    expect(hostState.commands.size).toBe(0); expect((await service.execute('example')).ok).toBe(false); expect(execute).not.toHaveBeenCalled();
  });
  it('[COMMAND-HOST-03] cleanup failures are observed without reviving the disposed dispatcher', async () => {
    const plugin = new FixturePlugin(new App(), manifest); const errors = { report: vi.fn() }; const execute = vi.fn();
    const command = defineCommand({ id: 'example', titleKey: 'command.example', execute });
    const service = new CommandService([{ commands: [command], ribbons: [defineRibbon(command, { id: 'ribbon', icon: 'blocks' })] }], errors, { validKey: () => true });
    const stop = bindCommands(plugin, service, key => key, errors); const ribbon = hostState.ribbons[0];
    if (!ribbon) throw new Error('Missing ribbon');
    vi.spyOn(ribbon.element, 'remove').mockImplementationOnce(() => { throw new Error('DOM cleanup'); });
    vi.mocked(plugin.removeCommand).mockImplementationOnce(() => { throw new Error('host cleanup'); });
    expect(stop).not.toThrow(); expect(service.available('example')).toBe(false);
    expect(errors.report.mock.calls).toEqual([['command.ribbon-dispose', 'command.dispose'], ['command.unregister', 'command.dispose']]);
  });
  it('[COMMAND-HOST-04] a host command registered before an exception is removed before plugin unload', async () => {
    const plugin = new FixturePlugin(new App(), manifest); const errors = { report: vi.fn() }; const execute = vi.fn();
    const command = defineCommand({ id: 'partial', titleKey: 'command.example', execute });
    const service = new CommandService([{ commands: [command] }], errors, { validKey: () => true });
    const original = plugin.addCommand.bind(plugin);
    vi.spyOn(plugin, 'addCommand').mockImplementation(value => { original(value); throw new Error('registered then threw'); });
    expect(() => bindCommands(plugin, service, key => key, errors)).toThrow('registered then threw');
    expect(hostState.commands.size).toBe(0); expect(plugin.removeCommand).toHaveBeenCalledExactlyOnceWith('partial');
    expect((await service.execute('partial')).ok).toBe(false); expect(execute).not.toHaveBeenCalled();
  });
  it('[COMMAND-HOST-05] a later ribbon failure removes earlier acquired handles', () => {
    const plugin = new FixturePlugin(new App(), manifest); const errors = { report: vi.fn() };
    const command = defineCommand({ id: 'example', titleKey: 'command.example', execute() {} });
    const service = new CommandService([{ commands: [command], ribbons: [defineRibbon(command, { id: 'first', icon: 'blocks' }), defineRibbon(command, { id: 'second', icon: 'blocks' })] }], errors, { validKey: () => true });
    let first: HTMLElement | undefined;
    vi.mocked(plugin.addRibbonIcon).mockImplementationOnce(() => { first = document.createElement('button'); document.body.append(first); return first; })
      .mockImplementationOnce(() => { throw new Error('second ribbon failed'); });
    expect(() => bindCommands(plugin, service, key => key, errors)).toThrow('second ribbon failed');
    expect(first?.isConnected).toBe(false); expect(hostState.commands.size).toBe(0);
  });
});
