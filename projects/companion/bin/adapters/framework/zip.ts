import { portableFile } from './archive-path.ts';
import { requireThat } from './contracts.ts';
export interface ArchiveFile { path: string; bytes: Buffer }
function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
/** Deterministic standard ZIP, stored entries, UTF-8 names, fixed DOS epoch. No ZIP64. */
export function zip(files: readonly ArchiveFile[]): Buffer {
  requireThat(files.length > 0 && files.length < 65535, 'ARCHIVE_LIMIT', 'Invalid archive entry count.');
  const locals: Buffer[] = [], central: Buffer[] = [], seen = new Set<string>(); let offset = 0;
  for (const file of [...files].sort((a, b) => a.path < b.path ? -1 : 1)) {
    requireThat(portableFile(file.path) && !seen.has(file.path.toLowerCase()), 'ARCHIVE_PATH', 'Unsafe or duplicate archive path.');
    seen.add(file.path.toLowerCase()); const name = Buffer.from(file.path), size = file.bytes.length, crc = crc32(file.bytes);
    requireThat(name.length <= 65535 && size <= 8_000_000 && offset + size + name.length + 30 <= 100_000_000, 'ARCHIVE_LIMIT', 'Archive size limit exceeded.');
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6);
    local.writeUInt16LE(33, 12); local.writeUInt32LE(crc, 14); local.writeUInt32LE(size, 18); local.writeUInt32LE(size, 22); local.writeUInt16LE(name.length, 26);
    locals.push(local, name, file.bytes);
    const header = Buffer.alloc(46); header.writeUInt32LE(0x02014b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(20, 6); header.writeUInt16LE(0x800, 8);
    header.writeUInt16LE(33, 14); header.writeUInt32LE(crc, 16); header.writeUInt32LE(size, 20); header.writeUInt32LE(size, 24); header.writeUInt16LE(name.length, 28); header.writeUInt32LE(offset, 42);
    central.push(header, name); offset += local.length + name.length + size;
  }
  const index = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(index.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, index, end]);
}
