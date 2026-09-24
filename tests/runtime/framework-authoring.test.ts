import { expect, it, vi } from 'vitest';
import { createActionScope, type ActionScope, type AuthoringExtension, type AuthoringServices, type PluginDataStatus } from '../../src/features/api';
import { authoringFixture } from './authoring-fixture';

it('FRAMEWORK-AUTHOR-01 a feature uses public recovery and lifetime capabilities without host or persistence internals', async () => {
  const fixture = await authoringFixture();
  const services: AuthoringServices = fixture.services;
  const status: PluginDataStatus = services.preferences.persistenceStatus;
  expect(status).toBe('absent');
  expect(services.preferences.readErrorKey).toBeUndefined();
  expect(services.preferences.recoveryKey).toBeUndefined();
  const owner: ActionScope = createActionScope();
  const run = vi.fn();
  const release = services.notices.registerActions('feature:example', {
    review: { labelKey: 'review', available: () => owner.active(), run },
  });
  const extension: AuthoringExtension = {
    commands: [],
    dispose() { owner.dispose(); release(); services.modals.closeOwner('feature:example'); },
  };
  try {
    const notice = services.notices.error({ owner: 'feature:example', operation: 'review', key: 'review.required', actions: ['review'] });
    if (!notice) throw new Error('Missing authored recovery notice');
    expect(await services.notices.invoke(notice.id, 'review')).toBe(true);
    expect(run).toHaveBeenCalledOnce();
    extension.dispose();
    expect(await services.notices.invoke(notice.id, 'review')).toBe(false);
    expect(notice.update({ kind: 'success', key: 'late' })).toBe(false);
    expect(fixture.saved).toEqual([]);
    expect(services.diagnostics.report).not.toHaveBeenCalled();
  } finally { extension.dispose(); fixture.dispose(); }
});
