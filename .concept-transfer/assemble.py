"""One-time, hash-verified transport of reviewed concept sources; no project execution."""
from __future__ import annotations
import hashlib
import io
import json
import lzma
from pathlib import Path, PurePosixPath
import subprocess
import sys
import tarfile
import zipfile

ROOT = Path.cwd().resolve()
TRANSFER = ROOT / '.concept-transfer'
MANIFEST = json.loads((TRANSFER / 'manifest.json').read_text())
EXPECTED_ARCHIVE = '6eb783eaf28f5c9c3bf0cb4add790f75e3eeb1899ca083911dbbcf9910c0bfcb'
EXPECTED_HTML = 'ddc15ef2c7d5c7177f45064d367ba3830ca4353a1ad2a5f29ec08dd2430c1d34'
BASE_COMMIT = '4615e7e61478f40b71d879298eeb75772ce6cc0d'
BASE_HASH = 'f3d1c226026aef5fa9a9d3197dd44cb993346fa98ac0c0c838850d2c20668a9c'
VENDOR_ZIP_HASH = '9b6f75c5a4053e0d7c7928ce6b4dff463910f9ffb091879637e8e13eab0c34e0'
VENDORS = {
 'vue.runtime.global.prod.js': ('vue/package/dist/vue.runtime.global.prod.js', 'f2f1547993b942e5e24f2d6e63577b21739a37a920e09c656b0e87eb0ad55175'),
 'pinia.iife.prod.js': ('pinia/package/dist/pinia.iife.prod.js', '8101551218f6b4665baa35aef1d97096c69833afbf68cc13a43032759662343d'),
 'vue-flow-core.iife.js': ('vue-flow-core/package/dist/vue-flow-core.iife.js', '92cd354fac92f7a998565c40d6e3b59d9031dfc56db4d393a524cdb57cf27edc'),
}

def verify(data: bytes, digest: str) -> None:
 if hashlib.sha256(data).hexdigest() != digest:
  raise ValueError('Content digest mismatch; nothing may be promoted')

def target(name: str) -> Path:
 path = PurePosixPath(name)
 allowed = ('docs/concepts/companion/', 'scripts/concepts/', 'tests/concepts/')
 if not name.startswith(allowed) and name != 'docs/product/COMPANION-COMPONENT-LIBRARY.md':
  raise ValueError('Path outside the reviewed concept scope: ' + name)
 if path.is_absolute() or '..' in path.parts or '\\' in name:
  raise ValueError('Unsafe path: ' + name)
 dest = ROOT.joinpath(*path.parts)
 if not dest.resolve().is_relative_to(ROOT):
  raise ValueError('Path escapes checkout')
 if dest.is_symlink() or any(p.is_symlink() for p in dest.parents if p != ROOT):
  raise ValueError('Symlink destination rejected')
 return dest

if MANIFEST.get('schema') != 1 or MANIFEST.get('archive_sha256') != EXPECTED_ARCHIVE:
 raise ValueError('Unreviewed transfer manifest')
parts = []
for i, part in enumerate(MANIFEST['parts']):
 if part['path'] != f'.concept-transfer/part-{i:02}.bin':
  raise ValueError('Unexpected chunk order')
 data = (ROOT / part['path']).read_bytes()
 if len(data) != part['bytes']:
  raise ValueError('Chunk size mismatch')
 oid = hashlib.sha1(f'blob {len(data)}\0'.encode() + data).hexdigest()
 if oid != part['sha']:
  raise ValueError('Chunk identity mismatch')
 parts.append(data)
raw = b''.join(parts)
if len(raw) != 124896:
 raise ValueError('Archive size mismatch')
verify(raw, EXPECTED_ARCHIVE)
decoder = lzma.LZMADecompressor(memlimit=134217728)
unpacked = decoder.decompress(raw, max_length=4194305)
if len(unpacked) > 4194304 or not decoder.eof or decoder.unused_data:
 raise ValueError('Archive exceeds reviewed limits')
files = {}
with tarfile.open(fileobj=io.BytesIO(unpacked), mode='r:') as archive:
 for member in archive.getmembers():
  if not member.isfile() or member.size > 1000000 or member.name in files:
   raise ValueError('Unsupported archive member')
  target(member.name)
  stream = archive.extractfile(member)
  if stream is None:
   raise ValueError('Missing member bytes')
  files[member.name] = stream.read()
if len(files) != 67 or sum(map(len, files.values())) > 2097152:
 raise ValueError('Unexpected source inventory')
base = subprocess.check_output(['git', 'show', BASE_COMMIT + ':docs/concepts/companion/index.html'])
verify(base, BASE_HASH)
files['docs/concepts/companion/src/base.html'] = base
zip_bytes = Path(sys.argv[1]).resolve().read_bytes()
verify(zip_bytes, VENDOR_ZIP_HASH)
with zipfile.ZipFile(io.BytesIO(zip_bytes)) as archive:
 for name, (entry, digest) in VENDORS.items():
  data = archive.read(entry)
  verify(data, digest)
  files['docs/concepts/companion/vendor/' + name] = data
# Validate all bytes and paths before replacing any source file.
for name, data in files.items():
 dest = target(name)
 dest.parent.mkdir(parents=True, exist_ok=True)
 dest.write_bytes(data)
subprocess.run([sys.executable, 'scripts/concepts/build-companion.py'], check=True)
html = target('docs/concepts/companion/index.html').read_bytes()
verify(html, EXPECTED_HTML)
subprocess.run([sys.executable, 'scripts/concepts/build-companion.py', '--check'], check=True)
print(json.dumps({'scope': 'Exact concept source transport and reassembly only',
 'sourceFiles': len(files), 'htmlBytes': len(html), 'htmlSha256': EXPECTED_HTML,
 'nativePluginTested': False, 'cliTested': False}, indent=2))
