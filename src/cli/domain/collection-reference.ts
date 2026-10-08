import { hasPortableProjectSegments, hasProtectedProjectRoot } from '#shared/platform/project-path.ts';
import { requireSketch } from '#shared/contracts/sketch-errors.ts';
/**
 * Reference kinds a frontmatter text or list field may `accept`: `path` (a portable project-relative path outside
 * protected roots, such as `prototypes/checkout`), `release-version` (`1.2.3` or `1.2.3-rc.1`) and id prefixes such as
 * `RISK-` (`RISK-0001`). Only the format is checked; whether the target exists is not (hooks and reads stay pure).
 */
export const collectionReleaseVersion = /^(?:0|[1-9]\d{0,5})\.(?:0|[1-9]\d{0,5})\.(?:0|[1-9]\d{0,5})(?:-rc\.(?:0|[1-9]\d{0,3}))?$/;
const referenceKinds: readonly string[] = ['path', 'release-version'];
const prefixPattern = /^[A-Z][A-Z0-9]{0,9}-$/, idLike = /^[A-Z][A-Z0-9]{0,9}-\d+$/;
/** The validated, de-duplicated `accepts` list of a field definition. */
export function readCollectionAccepts(value: unknown, name: string): string[] {
  requireSketch(Array.isArray(value) && value.length > 0 && value.length <= 12, 'COLLECTION_DEFINITION', `${name} needs 1–12 reference kinds.`);
  for (const kind of value) requireSketch(typeof kind === 'string' && (referenceKinds.includes(kind) || prefixPattern.test(kind)), 'COLLECTION_DEFINITION',
    `${name} entries are path, release-version or id prefixes such as RISK-.`);
  requireSketch(new Set(value).size === value.length, 'COLLECTION_DEFINITION', `${name} entries must be unique.`);
  return value.map(String);
}
/** An id-shaped value must use an accepted prefix; anything else must be an accepted version or path. */
export function collectionReferenceOk(accepts: readonly string[], value: string): boolean {
  if (idLike.test(value)) return accepts.some(kind => kind.endsWith('-') && value.startsWith(kind) && /^\d{3,9}$/.test(value.slice(kind.length)));
  if (accepts.includes('release-version') && collectionReleaseVersion.test(value)) return true;
  return accepts.includes('path') && hasPortableProjectSegments(value) && !hasProtectedProjectRoot(value);
}
/** `a project-relative path or ids like RISK-0001, LRN-0001` for messages. */
export function collectionAcceptsText(accepts: readonly string[]): string {
  const ids = accepts.filter(kind => kind.endsWith('-')).map(kind => kind + '0001');
  const parts = [...(accepts.includes('path') ? ['a project-relative path'] : []), ...(accepts.includes('release-version') ? ['a version like 1.2.3 or 1.2.3-rc.1'] : []),
    ...(ids.length ? ['ids like ' + ids.join(', ')] : [])];
  return parts.join(' or ');
}
