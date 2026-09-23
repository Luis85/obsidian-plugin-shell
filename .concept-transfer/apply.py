"""Reconstruct exactly reviewed concept files; no shell expressions in input data."""
from pathlib import Path, PurePosixPath
import hashlib, json, subprocess
ROOT=Path(__file__).resolve().parents[1]
HERE=Path(__file__).resolve().parent
manifest=json.loads((HERE/'manifest.json').read_text())
def digest(raw):return hashlib.sha256(raw).hexdigest()
pending={}
for part in manifest['parts']:
    name=part['path']
    if PurePosixPath(name).name!=name or not name.startswith('part-') or not name.endswith('.json'):raise ValueError('Unsafe part name')
    raw=(HERE/name).read_bytes()
    if digest(raw)!=part['sha256']:raise ValueError('Part checksum mismatch')
    for entry in json.loads(raw):
        name=entry['path'];path=ROOT/name
        if not name.startswith(('docs/concepts/companion/','scripts/concepts/','tests/concepts/')) or any(x in ['..','.'] for x in PurePosixPath(name).parts):raise ValueError('Path outside reviewed scope')
        if path.is_symlink() or any(p.is_symlink() for p in path.parents if p!=ROOT.parent):raise ValueError('Symlink forbidden')
        if name in pending:raise ValueError('Duplicate destination')
        if entry['before'] is None:
            if path.exists():raise ValueError('New-file conflict: '+name)
            result=entry['content']
        else:
            raw=path.read_bytes()
            if digest(raw)!=entry['before']:raise ValueError('Source changed: '+name)
            source=raw.decode('utf-8');cursor=0;pieces=[]
            for a,b,text in entry['edits']:
                if not isinstance(a,int) or not isinstance(b,int) or not cursor<=a<=b<=len(source):raise ValueError('Invalid edit range')
                pieces.extend([source[cursor:a],text]);cursor=b
            pieces.append(source[cursor:]);result=''.join(pieces)
        result=result.encode('utf-8')
        if len(result)>2000000 or digest(result)!=entry['after']:raise ValueError('Result mismatch: '+name)
        pending[name]=result
if set(pending)!=set(manifest['files']):raise ValueError('Manifest inventory mismatch')
for name,raw in pending.items():
    path=ROOT/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(raw)
subprocess.run(['python3','scripts/concepts/build-companion.py'],cwd=ROOT,check=True)
output=ROOT/'docs/concepts/companion/index.html'
if digest(output.read_bytes())!=manifest['html_sha256']:raise ValueError('Generated HTML differs from tested artifact')
print('Reconstructed',len(pending),'reviewed files and exact tested HTML')
