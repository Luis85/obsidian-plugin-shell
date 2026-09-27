import { describe, expect, it } from 'vitest';
import {
  customFileBasename,
  reservedFileExtensions,
  validFileExtension,
  validateFileContent,
  validateNativeDefinitions,
  type NativeFileDefinition,
} from '../../src/domain/native-integrations';
const file: NativeFileDefinition = {
  id: 'folio',
  name: 'Folio',
  extension: 'folio',
  format: 'json',
  initialContent: '{"title":"Untitled"}\n',
};
describe('native file domain safety', () => {
  it.each(['', '.folio', 'Folio', '../x', 'a.b', 'x/y', 'x y', 'a'.repeat(17)])(
    'rejects invalid extension %s',
    (extension) => {
      expect(validFileExtension(extension)).toBe(false);
      expect(() => validateNativeDefinitions([{ ...file, extension }], [])).toThrow(
        'NATIVE_EXTENSION_RESERVED_OR_INVALID',
      );
    },
  );
  it.each(reservedFileExtensions)('does not take over Obsidian .%s files', (extension) => {
    expect(() => validateNativeDefinitions([{ ...file, extension }], [])).toThrow(
      'NATIVE_EXTENSION_RESERVED_OR_INVALID',
    );
  });
  it('rejects duplicate identities and associations before registration', () => {
    expect(() => validateNativeDefinitions([file, file], [])).toThrow('NATIVE_ID_CONFLICT');
    expect(() => validateNativeDefinitions([file, { ...file, id: 'other' }], [])).toThrow('NATIVE_EXTENSION_CONFLICT');
    expect(() => validateNativeDefinitions([{ ...file, initialContent: '{bad' }], [])).toThrow(
      'NATIVE_INITIAL_CONTENT_INVALID',
    );
    expect(() => validateNativeDefinitions([{ ...file, name: 'bad\nname' }], [])).toThrow('NATIVE_NAME_INVALID');
    expect(() =>
      validateNativeDefinitions(
        [file],
        [{ id: 'inspect', name: 'Inspect', extensions: ['md', 'md'], run: () => ({ title: '', message: '' }) }],
      ),
    ).toThrow('NATIVE_MENU_INVALID');
  });
  it('validates without normalizing whitespace, Unicode or malformed text', () => {
    const raw = ' { "title": "Renovación 🛠" }\r\n';
    expect(validateFileContent(file, raw)).toBeNull();
    expect(raw).toBe(' { "title": "Renovación 🛠" }\r\n');
    expect(validateFileContent(file, '{bad')).toMatch(/original text is retained/);
    expect(validateFileContent({ ...file, validate: () => 'Missing title' }, '{}')).toBe('Missing title');
    expect(
      validateFileContent(
        {
          ...file,
          validate: () => {
            throw Error('sensitive');
          },
        },
        '{}',
      ),
    ).not.toContain('sensitive');
    expect(validateFileContent({ ...file, format: 'text' }, '<script>not executable</script>')).toBeNull();
  });
  it.each([
    '',
    '..',
    '../escape',
    '.obsidian',
    'sub/file',
    'sub\\file',
    'CON',
    'con.folio',
    'LPT1',
    'a.',
    'a:b',
    'a\n',
  ])('refuses unsafe basename %j', (value) => {
    expect(customFileBasename(value)).toBeNull();
  });
  it('accepts user-facing Unicode names as a single basename', () => {
    expect(customFileBasename('  Renovación 🛠  ')).toBe('Renovación 🛠');
    expect(customFileBasename('plan.folio')).toBe('plan.folio');
  });
});
