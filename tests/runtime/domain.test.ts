import { describe, it, expect } from 'vitest';
import { isCalendarDate } from '../../src/domain/entity';
import { parseTask } from '../../src/features/tasks/form';
import { validateFolder, validateDocumentTitle } from '../../src/domain/paths';
import { defaults, parsePreferences } from '../../src/domain/preferences';
import { input } from './helpers';
describe('Domain invariants', () => {
  it('[DOM-01] handles Gregorian leap years without timezone conversion', () => {
    for (const date of ['2024-02-29', '2000-02-29', '2026-03-29', '2026-10-25']) expect(isCalendarDate(date)).toBe(true);
    for (const date of ['1900-02-29', '2026-02-29', '0000-01-01', '2026-13-01', '2026-04-31', '2026-9-3']) expect(isCalendarDate(date)).toBe(false);
  });
  it('[DOM-02] rejects blank/oversized titles, tags and invalid dates', () => {
    for (const title of ['', '  ', 'x'.repeat(121)]) expect(parseTask({ ...input, title }).ok).toBe(false);
    expect(parseTask({ ...input, due: '2026-02-30' }).ok).toBe(false);
    expect(parseTask({ ...input, tags: 'bad tag' }).ok).toBe(false);
    expect(parseTask({ ...input, tags: Array.from({ length: 13 }, (_, i) => `t${i}`).join(',') }).ok).toBe(false);
  });
  it('[DOM-03] preserves title spelling and freezes unique trimmed tags', () => {
    const result = parseTask({ ...input, title: '  Release checklist  ' });
    expect(result).toEqual({ ok: true, value: { title: '  Release checklist  ', due: '2026-09-30', status: 'todo', tags: ['work', 'release'] } });
    if (result.ok) { expect(Object.isFrozen(result.value)).toBe(true); expect(Object.isFrozen(result.value.tags)).toBe(true); }
    const noDue = parseTask({ ...input, due: '' });
    if (noDue.ok) expect(noDue.value).not.toHaveProperty('due');
  });
  it('[DOM-04] rejects traversal, reserved and nonportable folders', () => {
    for (const folder of ['', '/Tasks', '../Tasks', 'Tasks/../x', '.obsidian', 'Tasks/CON', 'C:\\temp', 'a//b', 'a/b.', 'a/b ', 'a/<b>']) expect(validateFolder(folder).ok, folder).toBe(false);
    expect(validateFolder('Projects/Tasks')).toEqual({ ok: true, value: 'Projects/Tasks' });
    expect(validateDocumentTitle('Übersicht / Notes!')).toMatchObject({ ok: false, error: { key: 'error.filename' } });
    expect(validateDocumentTitle('日本語')).toEqual({ ok: true, value: '日本語' });
  });
  it('[DOM-05] validates preferences and rejects unknown properties', () => {
    expect(parsePreferences(defaults).ok).toBe(true);
    for (const raw of [null, [], {}, { ...defaults, locale: 'fr' }, { ...defaults, taskFolder: '../x' }, { ...defaults, notifySuccess: 'yes' }, { ...defaults, extra: true }]) expect(parsePreferences(raw).ok).toBe(false);
  });
});
