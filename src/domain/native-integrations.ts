/** Portable native capabilities. Domain handlers never receive Obsidian objects. */
export interface NativeFileDefinition {
  readonly id: string;
  readonly name: string;
  readonly extension: string;
  readonly format: 'json' | 'text';
  readonly initialContent: string;
  /** Additional domain validation; reports a message, never rewrites source bytes. */
  readonly validate?: (content: string) => string | null;
}
export interface NativeFileContext {
  readonly path: string;
  readonly name: string;
  readonly extension: string;
}
export interface NativeMenuResult {
  readonly title: string;
  readonly message: string;
}
export interface NativeMenuDefinition {
  readonly id: string;
  readonly name: string;
  readonly extensions: readonly string[];
  readonly run: (context: NativeFileContext) => NativeMenuResult | Promise<NativeMenuResult>;
}
/** Built-in file handlers must not be replaced by a generated custom extension. */
export const reservedFileExtensions: readonly string[] = [
  'md',
  'markdown',
  'canvas',
  'base',
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'svg',
  'webp',
  'avif',
  'bmp',
  'mp3',
  'wav',
  'm4a',
  'ogg',
  'flac',
  'mp4',
  'webm',
  'ogv',
  'mov',
  '3gp',
];
export function validFileExtension(extension: string): boolean {
  return /^[a-z][a-z0-9]{0,15}$/.test(extension);
}
export function validateFileContent(definition: NativeFileDefinition, content: string): string | null {
  if (definition.format === 'json') {
    try {
      JSON.parse(content);
    } catch {
      return 'Invalid JSON. The original text is retained; correct it before using it as structured data.';
    }
  }
  try {
    return definition.validate?.(content) ?? null;
  } catch {
    return 'Document validation failed. The original text is retained.';
  }
}
function validateIdentity(definition: { readonly id: string; readonly name: string }, ids: Set<string>): void {
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(definition.id) || definition.id.length > 48 || ids.has(definition.id))
    throw new Error('NATIVE_ID_CONFLICT');
  ids.add(definition.id);
  if (!definition.name.trim() || definition.name.length > 80 || /[\r\n]/.test(definition.name))
    throw new Error('NATIVE_NAME_INVALID');
}
function validateFile(file: NativeFileDefinition, extensions: Set<string>): void {
  if (!validFileExtension(file.extension) || reservedFileExtensions.includes(file.extension))
    throw new Error('NATIVE_EXTENSION_RESERVED_OR_INVALID');
  if (extensions.has(file.extension)) throw new Error('NATIVE_EXTENSION_CONFLICT');
  extensions.add(file.extension);
  if (
    !['json', 'text'].includes(file.format) ||
    typeof file.initialContent !== 'string' ||
    file.initialContent.length > 65536 ||
    validateFileContent(file, file.initialContent)
  )
    throw new Error('NATIVE_INITIAL_CONTENT_INVALID');
}
function validateMenu(menu: NativeMenuDefinition): void {
  if (
    !menu.extensions.length ||
    menu.extensions.length > 16 ||
    menu.extensions.some((extension) => !validFileExtension(extension)) ||
    new Set(menu.extensions).size !== menu.extensions.length ||
    typeof menu.run !== 'function'
  )
    throw new Error('NATIVE_MENU_INVALID');
}
/** Validate source-authored registrations before mutating the host registry. */
export function validateNativeDefinitions(
  files: readonly NativeFileDefinition[],
  menus: readonly NativeMenuDefinition[],
): void {
  if (files.length > 12 || menus.length > 24) throw new Error('NATIVE_LIMIT_EXCEEDED');
  const ids = new Set<string>();
  const extensions = new Set<string>();
  for (const definition of [...files, ...menus]) validateIdentity(definition, ids);
  for (const file of files) validateFile(file, extensions);
  for (const menu of menus) validateMenu(menu);
}
/** A single basename, not a path: prevents traversal and hidden/configuration files. */
export function customFileBasename(value: string): string | null {
  if (Array.from(value).some((character) => character.charCodeAt(0) < 32)) return null;
  const name = value.trim();
  if (
    !name ||
    name.length > 100 ||
    /[<>:"/\\|?*]/.test(name) ||
    /^[.]/.test(name) ||
    /[. ]$/.test(name) ||
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)
  )
    return null;
  return name;
}

/** Join a trusted vault-folder path and a validated single user-entered basename. */
export function nativeFilePath(folder: string, input: string, extension: string): string | null {
  const basename = customFileBasename(input);
  if (!basename) return null;
  const suffix = '.' + extension;
  const name = basename.toLowerCase().endsWith(suffix) ? basename : basename + suffix;
  return (folder === '/' || !folder ? '' : folder + '/') + name;
}
