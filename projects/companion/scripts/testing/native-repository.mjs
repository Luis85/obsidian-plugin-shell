import { noteNativePhase } from './native-diagnostic-observer.mjs';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { parse } from 'yaml';
import { expect } from '@playwright/test';
import { assertDiagnostics } from './native-header-checks.mjs';

/** Uses a second synthetic note; the original cold-restart fixture is never changed. */
export async function qualifyRepository(page, report, output, vault, identity) {
  noteNativePhase(report, 'native-repository');
  const owned = page.locator(identity.viewSelector).first();
  await owned.getByRole('button', { name: 'Create another', exact: true }).click();
  await owned.getByRole('textbox', { name: 'Title', exact: true }).fill('Native repository Task');
  await owned.getByRole('button', { name: 'Preview Markdown', exact: true }).click();
  const preview = await owned.getByTestId('markdown-preview').innerText();
  const notePath = await owned.locator('.shell-destination code').innerText();
  await owned.getByRole('button', { name: 'Create Task note', exact: true }).click();
  await expect(owned.getByText('Task note created', { exact: true })).toBeVisible();
  expect(await readFile(join(vault, notePath), 'utf8')).toBe(preview);

  // A real host write models a manual edit outside the repository. Reload must
  // observe these bytes, and updating owned properties must retain them exactly.
  await page.evaluate(async path => {
    const app = window.app; const file = app.vault.getAbstractFileByPath(path);
    if (!file) throw new Error('NATIVE_REPOSITORY_NOTE_MISSING');
    await app.vault.process(file, current => current.replace(/^---\n/, '---\nexternal_owner: "kept"\n') + '\nHandwritten native notes must survive.\n');
  }, notePath);
  const before = await readFile(join(vault, notePath), 'utf8');
  const repository = owned.getByTestId('task-repository');
  await repository.getByRole('button', { name: 'Reload notes', exact: true }).click();
  await repository.getByRole('button', { name: 'Edit Native repository Task', exact: true }).click();
  await expect(repository.getByRole('textbox', { name: 'Task title', exact: true })).toHaveValue('Native repository Task');
  await expect(repository.getByLabel('Status', { exact: true })).toHaveValue('todo');
  report.checks.push('native-repository-list-reads-canonical-manually-edited-note');

  await repository.getByRole('textbox', { name: 'Task title', exact: true }).fill('Native repository revised');
  await repository.getByLabel('Status', { exact: true }).selectOption('done');
  await repository.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(repository.getByRole('status')).toContainText('Task changes saved.');
  const updated = await readFile(join(vault, notePath), 'utf8');
  const header = text => parse(text.slice(4, text.indexOf('\n---', 4)));
  const body = text => text.slice(text.indexOf('\n---\n') + 5);
  expect(header(updated)).toMatchObject({ title: 'Native repository revised', status: 'done', external_owner: 'kept' });
  expect(header(updated).id).toBe(header(before).id);
  expect(typeof header(before).created_at).toBe('string');
  expect(header(updated).created_at).toBe(header(before).created_at);
  expect(body(updated)).toBe(body(before));
  await repository.getByRole('button', { name: 'Reload notes', exact: true }).click();
  await repository.getByRole('button', { name: 'Edit Native repository revised', exact: true }).click();
  await expect(repository.getByLabel('Status', { exact: true })).toHaveValue('done');
  report.checks.push('native-repository-update-preserves-path-identity-user-properties-and-body');
  await repository.screenshot({ path: join(output, 'native-repository-updated.png') });

  await repository.getByRole('button', { name: 'Move to trash…', exact: true }).click();
  await repository.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await readFile(join(vault, notePath), 'utf8')).toBe(updated);
  await expect(repository.getByRole('button', { name: 'Confirm move to trash', exact: true })).toHaveCount(0);
  report.checks.push('native-repository-trash-cancellation-preserves-exact-note');
  await repository.getByRole('button', { name: 'Move to trash…', exact: true }).click();
  await repository.getByRole('button', { name: 'Confirm move to trash', exact: true }).click();
  await expect(repository.getByRole('status')).toHaveText('Task note moved to trash.');
  await expect(readFile(join(vault, notePath), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  // Verify recovery bytes inside this isolated vault, independently of UI success.
  const entries = await readdir(join(vault, '.trash'), { recursive: true, withFileTypes: true });
  const recovered = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const path = join(entry.parentPath, entry.name);
    if (await readFile(path, 'utf8') === updated) recovered.push(relative(vault, path));
  }
  expect(recovered).toHaveLength(1);
  await repository.getByRole('button', { name: 'Reload notes', exact: true }).click();
  await expect(repository.getByRole('button', { name: 'Edit Native repository revised', exact: true })).toHaveCount(0);
  report.repository = { path: notePath, localTrashPath: recovered[0], preservedBody: true, preservedIdentity: true };
  report.checks.push('native-repository-delete-removes-active-note-and-retains-exact-local-trash-bytes');
  await owned.getByRole('button', { name: 'Events & feedback', exact: true }).click();
  for (const type of ['host.vault.entry-created', 'host.vault.entry-modified', 'host.vault.entry-deleted', 'documents.updated', 'documents.deleted']) {
    await expect(owned.locator('.shell-event-table')).toContainText(type);
  }
  report.checks.push('native-host-bridge-publishes-normalized-crud-observations');
  await assertDiagnostics(page, identity);
}
