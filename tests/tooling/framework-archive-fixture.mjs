import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { crc32 } from 'node:zlib';
/** Independent central-directory reader used only by qualification, not by the ZIP writer. */
export async function extractArchive(bytes, root) {
  const end = bytes.length - 22;
  assert.equal(bytes.readUInt32LE(end), 0x06054b50);
  assert.equal(bytes.readUInt16LE(end + 20), 0);
  const count = bytes.readUInt16LE(end + 10), files = [];
  let cursor = bytes.readUInt32LE(end + 16);
  const indexEnd = cursor + bytes.readUInt32LE(end + 12);
  assert.equal(indexEnd, end);
  for (let i = 0; i < count; i++) {
    assert.equal(bytes.readUInt32LE(cursor), 0x02014b50);
    assert.equal(bytes.readUInt16LE(cursor + 10), 0, 'stored entries only');
    const size = bytes.readUInt32LE(cursor + 24), local = bytes.readUInt32LE(cursor + 42);
    const nameLength = bytes.readUInt16LE(cursor + 28);
    const name = bytes.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    assert.ok(!/[:\\\x00-\x1f]/.test(name) && !name.split('/').some(part => !part || part === '.' || part === '..'));
    assert.ok(!files.includes(name));
    assert.equal(bytes.readUInt32LE(local), 0x04034b50);
    assert.equal(bytes.readUInt16LE(local + 8), 0);
    assert.equal(bytes.readUInt32LE(local + 22), size);
    const localNameLength = bytes.readUInt16LE(local + 26), extraLength = bytes.readUInt16LE(local + 28);
    assert.equal(bytes.subarray(local + 30, local + 30 + localNameLength).toString('utf8'), name);
    const start = local + 30 + localNameLength + extraLength, content = bytes.subarray(start, start + size);
    assert.ok(start + size <= bytes.readUInt32LE(end + 16));
    assert.equal(content.length, size); assert.equal(crc32(content), bytes.readUInt32LE(cursor + 16));
    assert.equal(crc32(content), bytes.readUInt32LE(local + 14));
    await mkdir(dirname(join(root, name)), { recursive: true }); await writeFile(join(root, name), content, { flag: 'wx' }); files.push(name);
    cursor += 46 + nameLength + bytes.readUInt16LE(cursor + 30) + bytes.readUInt16LE(cursor + 32);
  }
  assert.equal(cursor, indexEnd); return files;
}
