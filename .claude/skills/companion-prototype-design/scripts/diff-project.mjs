import { args, need, readBytes, sha256, isMain, cli } from './lib/io.mjs';
function pointer(key) { return String(key).replaceAll('~', '~0').replaceAll('/', '~1'); }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
export function diffValues(before, after, at = '') {
  if (JSON.stringify(canonical(before)) === JSON.stringify(canonical(after))) return [];
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  if (object(before) && object(after)) {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].sort().flatMap(key => {
      const target = `${at}/${pointer(key)}`;
      if (!Object.hasOwn(before, key)) return [{ op: 'add', path: target }];
      if (!Object.hasOwn(after, key)) return [{ op: 'remove', path: target }];
      return diffValues(before[key], after[key], target);
    });
  }
  // Arrays are one conservative change. It is not an executable JSON Patch or merge.
  return [{ op: 'replace', path: at }];
}
export function changeReport(beforeBytes, afterBytes) {
  const decoder = () => new TextDecoder('utf-8', { fatal: true });
  const before = JSON.parse(decoder().decode(beforeBytes));
  const after = JSON.parse(decoder().decode(afterBytes));
  if (!before.project?.id || !after.project?.id || before.project.id !== after.project.id) {
    throw new Error('Feature/improvement baseline must preserve project identity');
  }
  return { kind: 'prototype-change-set', schemaVersion: 1, executable: false,
    baselineSha256: sha256(beforeBytes), candidateSha256: sha256(afterBytes),
    changes: diffValues(before, after),
    limitations: ['Informational diff only; arrays are conservatively reported as a whole.',
      'Review stable IDs and unaffected definitions separately. Never send this file to the companion importer.'] };
}
if (isMain(import.meta.url)) cli(() => {
  const options = args(process.argv.slice(2), ['--before', '--after'], ['--help']);
  if (options.help) return console.log('Usage: node diff-project.mjs --before <baseline.json> --after <candidate.json>');
  console.log(JSON.stringify(changeReport(readBytes(need(options, 'before'), 4_000_000),
    readBytes(need(options, 'after'), 4_000_000)), null, 2));
});
