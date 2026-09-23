"""One-shot PR #5 object assembly. No ref updates, merges, releases or tags."""
import base64,hashlib,json,os,subprocess,sys,urllib.request,zlib
from pathlib import Path
PARENT='2d5b0d1d7469aa8de007d9af0b426b26c5de84cd'
TREE='4532ad4644d830ca9cc25ba0e9396188415f9c39'
DIGEST='dc4d3079eff5b64bf764cea70388dec0f62237b88aa2a58822a1283ef873c55e'
ROOT=Path.cwd(); TEMP=Path(os.environ['RUNNER_TEMP'])
PREFIX=Path('.github/companion-review-transport')
ALLOWED=set('''.fallowrc.json
.github/workflows/companion-concept-verification.yml
docs/concepts/companion/PRODUCT-REVIEW.md
docs/concepts/companion/PRODUCT-VERIFICATION.md
docs/concepts/companion/README.md
docs/concepts/companion/src/base.html
docs/concepts/companion/src/canvas-catalog.js
docs/concepts/companion/src/canvas-model.js
docs/concepts/companion/src/design-actions.js
docs/concepts/companion/src/design-dialogs.js
docs/concepts/companion/src/design-model.js
docs/concepts/companion/src/edge-editing.js
docs/concepts/companion/src/flow-model.js
docs/concepts/companion/src/flow-runtime.js
docs/concepts/companion/src/interaction-polish.js
docs/concepts/companion/src/state-safety.js
docs/concepts/companion/src/surface.css
docs/concepts/companion/verification-product.json
scripts/concepts/build-companion.py
scripts/concepts/run-browser-checks.py
tests/concepts/companion-assembly.test.py
tests/concepts/companion-containers.browser.py
tests/concepts/companion-reconciliation.browser.py
tests/concepts/companion-reference-graph.browser.py
tests/concepts/companion-reference.browser.py
tests/concepts/companion-safety.browser.py
tests/concepts/companion-storage.browser.py
tests/concepts/companion-unified.browser.py
tests/tooling/companion-boundaries.checks.mjs'''.splitlines())
def git(*args):return subprocess.check_output(['git',*args],text=True).strip()
def blob(data):return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
def manifest():
    parts=[(ROOT/PREFIX/str(i)).read_text() for i in range(6)]
    # Correct known text-transport transcription errors; the full decoded payload
    # must still match its independently recorded SHA-256 before any mutation.
    for i,pairs in {0:[('Li7wA1','Li7wqA1'),('sC/WWV8','sC/WV8'),('lz5vYEW','lz5/vYEW')],2:[('yLOsi7LCgE','yLOsiIL67JKcgE'),('WCrEyrUOSetgx','WCrEyrUSetgx'),('CljVRkD','ClVRkD')]}.items():
        for old,new in pairs:
            assert parts[i].count(old)==1
            parts[i]=parts[i].replace(old,new)
    raw=zlib.decompress(base64.b64decode(''.join(parts)+'we2/AXnRWwk=',validate=True))
    assert hashlib.sha256(raw).hexdigest()==DIGEST
    m=json.loads(raw)
    assert m['schema']==1 and m['parent']==PARENT
    assert len(m['files'])==len(ALLOWED) and {x['path'] for x in m['files']}==ALLOWED
    assert m['output']['path']=='docs/concepts/companion/index.html'
    return m
assert os.environ['GITHUB_REPOSITORY']=='Luis85/obsidian-plugin-shell'
assert os.environ['GITHUB_REF']=='refs/heads/docs/companion-plugin-prd'
assert git('rev-parse','HEAD')==os.environ['GITHUB_SHA']
assert git('rev-parse','HEAD^')==PARENT
assert git('rev-parse','HEAD^:')==TREE
m=manifest()
if sys.argv[1]=='apply':
    assert not git('status','--porcelain')
    for f in m['files']:
        p=ROOT/f['path']; assert not p.is_symlink()
        if f['before'] is None:
            assert not p.exists(); data=f['content'].encode()
        else:
            before=p.read_bytes(); assert blob(before)==f['before'],f['path']
            lines=before.decode().splitlines(keepends=True)
            for start,end,text in reversed(f['edits']):
                assert 0<=start<=end<=len(lines)
                lines[start:end]=[text]
            data=''.join(lines).encode()
        assert blob(data)==f['after'] and hashlib.sha256(data).hexdigest()==f['sha256'],f['path']
        p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
    subprocess.run(['python3','scripts/concepts/build-companion.py'],check=True)
    output=(ROOT/m['output']['path']).read_bytes()
    assert len(output)==m['output']['bytes'] and hashlib.sha256(output).hexdigest()==m['output']['sha256']
    subprocess.run(['python3','tests/concepts/companion-assembly.test.py'],check=True)
    for p in sorted((ROOT/'docs/concepts/companion/src').glob('*.js')):
        subprocess.run(['node','--check',str(p)],check=True)
    subprocess.run(['git','diff','--check'],check=True)
    (TEMP/'companion-verified.json').write_text(json.dumps({'head':git('rev-parse','HEAD'),'manifest':DIGEST}))
elif sys.argv[1]=='publish':
    verified=json.loads((TEMP/'companion-verified.json').read_text())
    assert verified=={'head':git('rev-parse','HEAD'),'manifest':DIGEST}
    def post(resource,value):
        assert resource in ('blobs','trees','commits')
        request=urllib.request.Request('https://api.github.com/repos/Luis85/obsidian-plugin-shell/git/'+resource,data=json.dumps(value).encode(),method='POST',headers={'Authorization':'Bearer '+os.environ['GH_TOKEN'],'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json','User-Agent':'companion-exact-source-review'})
        with urllib.request.urlopen(request,timeout=60) as response:return json.load(response)
    files=m['files']+[{'path':m['output']['path'],'sha256':m['output']['sha256']}]
    elements=[]
    for f in files:
        data=(ROOT/f['path']).read_bytes()
        assert hashlib.sha256(data).hexdigest()==f['sha256'],f['path']
        b=post('blobs',{'content':data.decode(),'encoding':'utf-8'})
        assert b['sha']==blob(data)
        elements.append({'path':f['path'],'mode':'100644','type':'blob','sha':b['sha']})
    tree=post('trees',{'base_tree':TREE,'tree':elements})
    commit=post('commits',{'message':m['message'],'tree':tree['sha'],'parents':[verified['head']]})
    receipt={'commit':commit['sha'],'tree':tree['sha'],'parent':verified['head'],'original_parent':PARENT,'manifest_sha256':DIGEST,'html':m['output'],'files':elements,'ref_updated':False}
    (TEMP/'companion-final-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print('Created verified candidate commit '+commit['sha']+'; no branch ref updated.')
else:raise ValueError('Expected apply or publish')
