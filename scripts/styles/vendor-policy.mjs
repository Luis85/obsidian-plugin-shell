/** One immutable third-party fixture exception, never a directory-wide lint bypass. */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
export const vendorPath = 'harness/styles/vendor/obsidian.css';
export const vendorArchive = 'harness/styles/vendor/obsidian.css.gz';
export const upstreamBlob = 'eb7b27320341f9ed0874bf152ed9955d82d38221';
export function gitBlob(data) {
  return createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');
}
export function assertVendor(data) {
  if (gitBlob(data) !== upstreamBlob) throw new Error('VENDOR_SNAPSHOT_MISMATCH');
}

export function decodeVendor(archive) {
  const data = gunzipSync(archive, { maxOutputLength:146116 }); assertVendor(data); return data;
}
export async function readVendor(root) { return decodeVendor(await readFile(resolve(root,vendorArchive))); }

/** Repair only the documented comment terminator; preserve the pinned source archive. */
export function runtimeVendorCss(data) {
  assertVendor(data);
  const text = data.toString('utf8');
  const unsafe = '--page-*/--scale-factor';
  if (text.split(unsafe).length !== 2) throw new Error('VENDOR_COMMENT_PATCH_PRECONDITION');
  return text.replace(unsafe, '--page-* / --scale-factor');
}
