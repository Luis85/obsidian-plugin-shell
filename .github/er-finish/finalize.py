"""Finish the reviewed idle-port fix. No ref updates or release operations."""
import hashlib,json,os,subprocess,sys,urllib.request
from pathlib import Path
PARENT='cebb25e0a35aa1636659cc27670630813cb8d64a'
TREE='f47ee7e7af17ab276d15b96e9226badf85fba23c'
DIGEST='2360942a52f0a96cd8d006e5c24390e33a0ddb610f4e0e312b16e032743b862b'
ROOT=Path.cwd();TEMP=Path(os.environ['RUNNER_TEMP']);REPO='Luis85/obsidian-plugin-shell'
ALLOWED={'docs/concepts/companion/src/semantic-interaction.js','docs/concepts/companion/src/semantic.css','tests/concepts/companion-er-polish.browser.py','docs/concepts/companion/ER-EDITOR-REVIEW.md','docs/concepts/companion/ER-EDITOR-VERIFICATION.md'}
def digest(b):return hashlib.sha256(b).hexdigest()
def blob(b):return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
def git(*args):return subprocess.check_output(['git',*args],text=True).strip()
def verified(f):
 b=(ROOT/f['path']).read_bytes();assert digest(b)==f['after'] and blob(b)==f['blob'],f['path'];return b
assert os.environ['GITHUB_REPOSITORY']==REPO and os.environ['GITHUB_REF']=='refs/heads/docs/companion-plugin-prd'
assert git('rev-parse','HEAD')==os.environ['GITHUB_SHA'] and git('rev-parse','HEAD^')==PARENT and git('rev-parse','HEAD^:')==TREE
raw=(ROOT/'.github/er-finish/manifest.json').read_bytes();assert digest(raw)==DIGEST
m=json.loads(raw);assert m['parent']==PARENT and m['tree']==TREE
assert len(m['files'])==len(ALLOWED) and {f['path'] for f in m['files']}==ALLOWED
assert m['output']['path']=='docs/concepts/companion/index.html'
files=m['files']+[m['output']]
if sys.argv[1]=='apply':
 assert 'GH_TOKEN' not in os.environ and not git('status','--porcelain')
 for f in m['files']:
  p=ROOT/f['path'];assert not any(a.is_symlink() for a in [p,*p.parents])
  b=p.read_bytes();assert digest(b)==f['before'],f['path'];lines=b.decode().splitlines(keepends=True)
  for start,end,text in reversed(f['edits']):
   assert 0<=start<=end<=len(lines);lines[start:end]=[text]
  p.write_bytes(''.join(lines).encode());verified(f)
 subprocess.run(['python3','-B','scripts/concepts/build-companion.py'],check=True)
 assert len(verified(m['output']))==m['output']['bytes']
 subprocess.run(['python3','-B','tests/concepts/companion-assembly.test.py'],check=True)
 for p in sorted((ROOT/'docs/concepts/companion/src').glob('*.js')):subprocess.run(['node','--check',str(p)],check=True)
 subprocess.run(['git','diff','--check'],check=True)
 (TEMP/'er-finish-verified.json').write_text(json.dumps({'head':git('rev-parse','HEAD'),'manifest':DIGEST}))
elif sys.argv[1]=='publish':
 assert json.loads((TEMP/'er-finish-verified.json').read_text())=={'head':git('rev-parse','HEAD'),'manifest':DIGEST}
 def post(resource,value):
  assert resource in ('blobs','trees','commits')
  r=urllib.request.Request('https://api.github.com/repos/'+REPO+'/git/'+resource,data=json.dumps(value).encode(),method='POST',headers={'Authorization':'Bearer '+os.environ['GH_TOKEN'],'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json','User-Agent':'exact-er-finish'})
  with urllib.request.urlopen(r,timeout=60) as response:return json.load(response)
 elements=[]
 for f in files:
  b=verified(f);r=post('blobs',{'content':b.decode(),'encoding':'utf-8'});assert r['sha']==f['blob'];elements.append({'path':f['path'],'mode':'100644','type':'blob','sha':r['sha']})
 tree=post('trees',{'base_tree':TREE,'tree':elements})
 commit=post('commits',{'message':'fix(concept): keep connected ER ports visible in idle state\n\nPreserve the visual endpoint even when a secondary handle is not hovered; only unused ports recede. Add a failing-before/passing-after rendered idle-port regression and retain exact artifact evidence.','tree':tree['sha'],'parents':[git('rev-parse','HEAD')]})
 (TEMP/'er-finish-receipt.json').write_text(json.dumps({'commit':commit['sha'],'tree':tree['sha'],'parent':git('rev-parse','HEAD'),'baseline':PARENT,'manifest':DIGEST,'output':m['output'],'files':elements,'ref_updated':False},indent=2)+'\n')
 print('Verified candidate '+commit['sha']+'; no ref updated.')
else:raise ValueError('Expected apply or publish')
