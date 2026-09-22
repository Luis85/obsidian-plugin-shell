"""One-off trusted authoring helper. Apply hash-bound text edits; create no branch/ref/release."""
import base64
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import urllib.request

REPO = 'Luis85/obsidian-plugin-shell'
BASE = '810618a2a404e91430b1cc5e7794ed746baca541'
PRODUCT_TREE = 'fe334506db75983317101eaa17e9a8a71bac8a81'

def sha(data):
    return hashlib.sha1(('blob %d\0' % len(data)).encode() + data).hexdigest()

def api(endpoint, payload):
    request = urllib.request.Request('https://api.github.com/repos/' + REPO + endpoint,
        data=json.dumps(payload).encode(), method='POST', headers={
          'Authorization':'Bearer ' + os.environ['GH_TOKEN'], 'Accept':'application/vnd.github+json',
          'Content-Type':'application/json', 'X-GitHub-Api-Version':'2022-11-28'})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)

def read_base(path):
    url='https://raw.githubusercontent.com/' + REPO + '/' + BASE + '/' + path
    with urllib.request.urlopen(url, timeout=30) as response:
        return response.read(300000)

records=[]
for number in range(1,7):
    records.extend(json.loads(Path('scripts/styles/edits/part%d.json' % number).read_text()))
prepared=[]
seen=set()
for record in records:
    path=record['path']; parts=PurePosixPath(path)
    assert path not in seen and not parts.is_absolute() and '..' not in parts.parts
    assert path.startswith(('docs/','harness/','scripts/','tests/')) or path in ('README.md','AGENTS.md')
    seen.add(path)
    if 'content' in record:
        text=record['content']
    else:
        base_path=record['basePath']; assert '..' not in PurePosixPath(base_path).parts
        data=read_base(base_path); assert sha(data)==record['baseSha'], 'base mismatch: '+path
        text=data.decode('utf-8'); last=len(text)
        for edit in reversed(record['edits']):
            assert 0 <= edit['start'] <= edit['end'] <= last
            text=text[:edit['start']]+edit['text']+text[edit['end']:]
            last=edit['start']
    data=text.encode('utf-8')
    assert sha(data)==record['targetSha'], 'target mismatch: '+path+' actual '+sha(data)
    prepared.append((path,data,record['targetSha']))
print('ALL_TARGET_HASHES_VALIDATED',len(prepared),flush=True)
entries=[]
for path,data,expected in prepared:
    result=api('/git/blobs',{'encoding':'base64','content':base64.b64encode(data).decode()})
    assert result['sha']==expected
    entries.append({'path':path,'mode':'100644','type':'blob','sha':expected})
    print(json.dumps({'path':path,'sha':expected}),flush=True)
result=api('/git/trees',{'base_tree':PRODUCT_TREE,'tree':entries})
print('PRODUCT_TREE '+result['sha'],flush=True)
print('No branch ref changed, no publication performed; temporary authoring files excluded.',flush=True)
