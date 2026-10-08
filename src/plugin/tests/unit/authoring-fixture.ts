import { vi } from 'vitest';
import { ModalService } from '../../application/modal-service';
import { NoticeService } from '../../application/notice-service';
import { PreferenceService } from '../../application/preference-service';
import { PluginDataStore } from '../../application/plugin-data-store';
import { TypedEventBus } from '../../infrastructure/events/typed-event-bus';
import { runtimeEventDefinitions } from '../../bootstrap/events';
import type { ShellEvents } from '../../application/events';
import type { ModalSink } from '../../application/modal-port';

/** Real application services; only persistence, dialogs, timer and host are doubles. */
export async function authoringFixture() {
  const diagnostics = { report: vi.fn() };
  const saved: unknown[] = [];
  const events = new TypedEventBus<ShellEvents>(diagnostics, runtimeEventDefinitions);
  const data = new PluginDataStore(
    {
      load: () => Promise.resolve(null),
      save: (value) => {
        saved.push(value);
        return Promise.resolve();
      },
    },
    diagnostics,
  );
  const preferences = new PreferenceService(data, events, diagnostics);
  await preferences.load();
  const dialogs: {
    spec: Parameters<ModalSink['open']>[0];
    callbacks: Parameters<ModalSink['open']>[1];
  }[] = [];
  let closed = 0;
  let noticed = 0;
  const modals = new ModalService(
    {
      open(spec, callbacks) {
        dialogs.push({ spec, callbacks });
        return {
          update() {},
          close() {
            closed++;
          },
        };
      },
    },
    (key) => key,
    diagnostics,
  );
  const notices = new NoticeService(
    {
      kind: 'browser',
      openDocument: () => Promise.resolve({ ok: true, value: undefined }),
      showModal() {},
      notice() {
        noticed++;
        return () => undefined;
      },
    },
    (key) => key,
    diagnostics,
    { scheduler: { after: () => () => undefined } },
  );
  return {
    services: { events, preferences, modals, notices, diagnostics },
    saved,
    data,
    dialogs,
    closed: () => closed,
    notices: () => noticed,
    dispose() {
      modals.dispose();
      notices.dispose();
      preferences.dispose();
      data.dispose();
      events.dispose();
    },
  };
}
