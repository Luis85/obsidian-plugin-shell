/** Count Unicode scalars without allocating encoded buffers; reject lossy surrogate replacement. */
function scalarBytes(character: string): number {
  if (character.length === 2) return 4;
  const code = character.charCodeAt(0);
  if (code <= 0x7f) return 1;
  if (code <= 0x7ff) return 2;
  return code >= 0xd800 && code <= 0xdfff ? 0 : 3;
}

/** Stop at the byte budget. Neither browser nor Node APIs are needed by callers. */
export function fitsUtf8Bytes(value: unknown, maximum: number): value is string {
  if (typeof value !== 'string' || !Number.isSafeInteger(maximum) || maximum < 0 || value.length > maximum) return false;
  let bytes = 0;
  for (const character of value) {
    const size = scalarBytes(character);
    if (!size) return false;
    bytes += size;
    if (bytes > maximum) return false;
  }
  return true;
}
