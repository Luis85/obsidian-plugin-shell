"""One-off authoring helper: stage verified blobs only; never update refs or publish."""
import base64
import gzip
import hashlib
import json
import os
import re
import urllib.request

REPO = 'Luis85/obsidian-plugin-shell'
SOURCE = 'ed5c50b76c481653b0bc19e30ebbf0a03e2da65c'
BASE = '810618a2a404e91430b1cc5e7794ed746baca541'
RAW_BLOB = 'eb7b27320341f9ed0874bf152ed9955d82d38221'

def blob_sha(data):
    return hashlib.sha1(('blob %d\0' % len(data)).encode() + data).hexdigest()

def get(path):
    with urllib.request.urlopen('https://raw.githubusercontent.com/' + path, timeout=30) as response:
        return response.read(300000)

def encode(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode()

def stage(name, data):
    body = json.dumps({'encoding':'base64', 'content':base64.b64encode(data).decode()}).encode()
    request = urllib.request.Request('https://api.github.com/repos/' + REPO + '/git/blobs', data=body,
        headers={'Authorization':'Bearer ' + os.environ['GH_TOKEN'], 'Accept':'application/vnd.github+json',
                 'Content-Type':'application/json', 'X-GitHub-Api-Version':'2022-11-28'}, method='POST')
    with urllib.request.urlopen(request, timeout=30) as response:
        result = json.load(response)
    assert result['sha'] == blob_sha(data), 'Git blob integrity mismatch'
    print(json.dumps({'name':name, 'sha':result['sha'], 'bytes':len(data)}), flush=True)

raw = get('Luis85/renovation-planner/' + SOURCE + '/tests/harness/obsidian.css')
assert len(raw) == 146116 and blob_sha(raw) == RAW_BLOB
assert hashlib.sha256(raw).hexdigest() == 'c82582f1a05fc9dc17582b028841021c537d05eb3d5f9aab551836b4cb37195c'
archive = bytearray(gzip.compress(raw, compresslevel=9, mtime=0))
archive[9] = 255
stage('harness/styles/vendor/obsidian.css.gz', bytes(archive))
stage('pinned-raw-source', raw)
raw_text = raw.decode('utf-8')
assert raw_text.count('--page-*/--scale-factor') == 1
stage('runtime-css', raw_text.replace('--page-*/--scale-factor', '--page-* / --scale-factor').encode())
names = sorted(set(re.findall(r'^\s*(--[a-zA-Z0-9-]+)\s*:', raw_text, re.M)))
assert len(names) == 968
inventory = {'schemaVersion':1, 'sourceBlob':RAW_BLOB,
             'meaning':'Lexically declared names in this reduced snapshot, not guaranteed computed values or a public API list.', 'names':names}
stage('harness/styles/vendor/token-inventory.json', encode(inventory))
plan_bytes = get(REPO + '/' + BASE + '/docs/testing/test-plan.json')
assert blob_sha(plan_bytes) == '0169c0a20776fd57ac90be095c9057cdb6695279'
plan = json.loads(plan_bytes)
assert len(plan['acceptance']) == 90
plan['baselineCommit'] = BASE
for suite in plan['suites']:
    if suite['id'] == 'http-specimen':
        suite['testIds'].append('HTTP-11')
        suite['scope'] = 'Pinned extracted host and explicit original simulator HTTP routes, response bytes/headers, source tripwires; not a running Obsidian host.'
    if suite['id'] == 'browser-specimen':
        suite['testIds'].extend(['BRW-09','BRW-10','BRW-11','BRW-12'])
        suite['scope'] = 'Selected host-profile specimen behavior and negative controls; no plugin runtime.'
plan['suites'].append({'id':'tokens','mode':'node-baseline','state':'executable',
    'file':'tests/verification/tokens.test.mjs','testIds':['TOK-%02d' % n for n in range(1,12)],
    'scope':'Pinned extracted host CSS, starter alias/catalog and profile policies; not native Obsidian compatibility.'})
gap = 'This scope checks stylesheet/token infrastructure only. Native comparison, plugin artifact build, and full theme compatibility remain separate unverified requirements.'
items = [
 (91,'Reviewed native token contract and scoped aliases','high','node-baseline',['TOK-01']),
 (92,'Extracted source integrity and narrow vendor exception','high','node-baseline',['TOK-02']),
 (93,'Host/plugin separation and profile load order','high','node-baseline',['TOK-05']),
 (94,'Theme override and missing-style browser checks','high','browser-specimen',['BRW-07','BRW-10','BRW-11']),
 (95,'Provenance does not claim unknown host or transfer upstream license','normal','node-baseline',['TOK-06']),
 (96,'Deprecated/missing aliases fail verification','normal','node-baseline',['TOK-04'])]
for n,summary,risk,mode,tests in items:
    plan['acceptance'].append({'id':'AC-%d' % n,'summary':summary,'risk':risk,'owner':'template maintainer',
        'requiredModes':[mode],'evidence':[{'testId':t,'extent':'whole'} for t in tests],'gap':gap})
stage('docs/testing/test-plan.json', encode(plan))
print('PINNED_INPUTS_STAGED; no branch ref changed and no release created', flush=True)
