// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { componentFixture, click, field, input, settle } from './component-fixture';
import { failure } from '../../src/domain/outcome';
import { deferred } from './helpers';

async function setup() {
  const f = await componentFixture();
  const created = await f.services.repositories.task.create({ title: 'Original', tags: ['work'] }, 'panel-seed');
  if (!created.ok) throw new Error('seed');
  await click(f.root, 'Documents');
  await click(f.root, 'Reload notes');
  await click(f.root, 'Edit');
  return { ...f, path: created.value.path };
}
it('[UI-03-01] real repository editor updates values, preserves hand-written content, and explicitly trashes', async () => {
  const f = await setup();
  try {
    expect(f.files.size).toBe(1);
    await input(field(f.root, 'edit-title'), 'Updated');
    const select = f.root.querySelector<HTMLSelectElement>('[name="edit-status"]');
    if (!select) throw new Error('status');
    select.value = 'done'; select.dispatchEvent(new Event('change', { bubbles: true })); await settle();
    await click(f.root, 'Save changes');
    expect(f.files.get(f.path)).toContain('title: "Updated"');
    expect(f.files.get(f.path)).toContain('status: "done"');
    expect(f.files.get(f.path)).toContain('# Original');
    expect(f.root.textContent).toContain('Task changes saved');
    await click(f.root, 'Move to trash…'); await click(f.root, 'Cancel');
    expect(f.files.size).toBe(1);
    await click(f.root, 'Move to trash…'); await click(f.root, 'Confirm move to trash');
    expect(f.files.size).toBe(0); expect(f.root.textContent).toContain('Task note moved to trash');
    await click(f.root, 'Reload notes'); expect(f.root.textContent).toContain('No Task notes in this folder');
    expect(f.observe).not.toHaveBeenCalled();
  } finally { f.dispose(); }
});
it('[UI-03-02] stale edits preserve the draft and external bytes until an explicit reload', async () => {
  const f = await setup();
  try {
    const manual = `${f.files.get(f.path)}\nHandwritten outside the app.\n`;
    f.files.set(f.path, manual);
    await input(field(f.root, 'edit-title'), 'Unsaved draft'); await click(f.root, 'Save changes');
    expect(f.root.textContent).toContain('Your draft is retained');
    expect(field(f.root, 'edit-title').value).toBe('Unsaved draft');
    expect(f.files.get(f.path)).toBe(manual);
    await click(f.root, 'Reload notes'); expect(f.root.querySelector('[name="edit-title"]')).toBeNull();
    await click(f.root, 'Edit'); expect(field(f.root, 'edit-title').value).toBe('Original');
    expect(f.observe).not.toHaveBeenCalled();
  } finally { f.dispose(); }
});
it('[UI-03-03] invalid values and failed delete do not show success or lose the note', async () => {
  const f = await setup();
  try {
    await input(field(f.root, 'edit-title'), ''); await click(f.root, 'Save changes');
    expect(f.root.querySelector('[role="alert"]')?.textContent).toContain('Enter a title');
    await input(field(f.root, 'edit-title'), 'Original');
    vi.spyOn(f.services.repositories.task, 'delete').mockResolvedValueOnce(failure('uncertain', 'error.uncertain'));
    await click(f.root, 'Move to trash…'); await click(f.root, 'Confirm move to trash');
    expect(f.files.size).toBe(1); expect(f.root.textContent).not.toContain('Task note moved to trash');
    expect(f.root.querySelector('fieldset')?.disabled).toBe(true);
    await click(f.root, 'Reload notes'); expect(f.root.querySelector('fieldset')).toBeNull();
  } finally { f.dispose(); }
});
it('[UI-03-04] folder changes invalidate selection and late list responses', async () => {
  const f = await setup();
  try {
    const repository = f.services.repositories.task;
    const barrier = deferred<Awaited<ReturnType<typeof repository.list>>>();
    const old = await repository.list();
    vi.spyOn(repository, 'list').mockReturnValueOnce(barrier.promise);
    const load = click(f.root, 'Reload notes'); await settle();
    await f.services.preferences.update({ taskFolder: 'Other' }); await settle();
    barrier.resolve(old); await load; await settle();
    expect(f.root.querySelector('[name="edit-title"]')).toBeNull();
    expect(f.root.textContent).not.toContain('Original');
    expect(f.files.size).toBe(1);
  } finally { f.dispose(); }
});
it('[UI-03-05] read and unexpected failures are visible without false success; disposal ignores late results', async () => {
  const f = await setup();
  try {
    const repository = f.services.repositories.task;
    vi.spyOn(repository, 'list').mockResolvedValueOnce(failure('storage', 'error.read'));
    await click(f.root, 'Reload notes'); expect(f.root.textContent).toContain('The note could not be read');
    vi.spyOn(repository, 'update').mockRejectedValueOnce(new Error('boundary'));
    await click(f.root, 'Save changes'); expect(f.root.textContent).toContain('An unexpected error was contained');
    expect(f.observe).toHaveBeenCalledWith(expect.objectContaining({ code: 'repository.unexpected' }));
    const barrier = deferred<Awaited<ReturnType<typeof repository.list>>>();
    const old = await repository.list(); vi.mocked(repository.list).mockReturnValueOnce(barrier.promise);
    const pending = click(f.root, 'Reload notes'); f.close(); barrier.resolve(old); await pending;
    expect(f.files.size).toBe(1);
  } finally { f.dispose(); }
});
