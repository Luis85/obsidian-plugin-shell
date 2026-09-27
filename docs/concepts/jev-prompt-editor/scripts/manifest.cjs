const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function inventory(dir = root) {
  return fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    if (['node_modules', '__pycache__', '.git'].includes(entry.name) || /\.(png|pyc)$/.test(entry.name)) return [];
    const full = path.join(dir, entry.name);
    assert(!entry.isSymbolicLink(), 'Unexpected symlink: ' + full);
    if (entry.isDirectory()) return inventory(full);
    if (full === path.join(root, 'MANIFEST.json')) return [];
    assert(entry.isFile(), 'Unexpected non-file: ' + full);
    const bytes = fs.readFileSync(full);
    return [{ path: path.relative(root, full).split(path.sep).join('/'), bytes: bytes.length, sha256: hash(bytes) }];
  });
}
const current = { kind: 'jev-studio-repository-manifest', schemaVersion: 1, artifactSha256: hash(fs.readFileSync(path.join(root, 'jev-studio.html'))), files: inventory() };
const target = path.join(root, 'MANIFEST.json');
if (process.argv.includes('--write')) {
  fs.writeFileSync(target, JSON.stringify(current, null, 2) + '\n');
  console.log('Recorded ' + current.files.length + ' files.');
} else {
  assert.deepEqual(current, JSON.parse(fs.readFileSync(target, 'utf8')), 'Repository concept inventory differs; inspect changes before regenerating the manifest.');
  console.log('Verified ' + current.files.length + ' files; artifact ' + current.artifactSha256);
}
