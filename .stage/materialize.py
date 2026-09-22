# One-time authoring transfer: verified source only; never part of the template.
import base64, hashlib, io, json, lzma, os, pathlib, urllib.request, zipfile
root = pathlib.Path.cwd()
raw = lzma.decompress(b''.join((root / f'.stage/payload-{i}.bin').read_bytes() for i in range(6)))
assert len(raw) == 166129
assert hashlib.sha256(raw).hexdigest() == 'ebf6cc0f544ddc984ffc7ed2ac8787c3ac3f9d93076f0425d801e95abe8d0d9b'
files = json.loads(raw)
assert isinstance(files, dict) and len(files) == 76
for name, content in files.items():
    path = pathlib.PurePosixPath(name)
    assert not path.is_absolute() and '..' not in path.parts and isinstance(content, str)
    target = root / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf8', newline='')
repo = 'Luis85/obsidian-plugin-shell'
headers = {'Authorization': 'Bearer ' + os.environ['GH_TOKEN'], 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'}
class ArtifactRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, hdrs, newurl):
        target = super().redirect_request(req, fp, code, msg, hdrs, newurl)
        target.remove_header('Authorization')
        return target
request = urllib.request.Request(f'https://api.github.com/repos/{repo}/actions/artifacts/10697906837/zip', headers=headers)
with urllib.request.build_opener(ArtifactRedirect()).open(request) as response:
    archive = zipfile.ZipFile(io.BytesIO(response.read()))
lock = json.loads(archive.read('package-lock.json'))
package = json.loads(files['package.json'])
for key in ('name', 'version'): lock[key] = package[key]
for key in ('name', 'version', 'license', 'dependencies', 'devDependencies', 'engines'): lock['packages'][''][key] = package[key]
files['package-lock.json'] = json.dumps(lock, indent=2, ensure_ascii=False) + '\n'
(root / 'package-lock.json').write_text(files['package-lock.json'], encoding='utf8', newline='')
def api(path, payload):
    request = urllib.request.Request(f'https://api.github.com/repos/{repo}/{path}', data=json.dumps(payload).encode(), headers=headers, method='POST')
    with urllib.request.urlopen(request) as response: return json.load(response)
entries = []
for name, content in sorted(files.items()):
    blob = api('git/blobs', {'encoding': 'base64', 'content': base64.b64encode(content.encode()).decode()})
    entries.append({'path': name, 'mode': '100644', 'type': 'blob', 'sha': blob['sha']})
product = api('git/trees', {'base_tree': '2464a7160dff1efe5fa705e966f9e26123b0597e', 'tree': entries})
(root / 'reports').mkdir(exist_ok=True)
(root / 'reports/source-tree.json').write_text(json.dumps({'tree': product['sha'], 'sourcePayload': hashlib.sha256(raw).hexdigest(), 'lockSha256': hashlib.sha256(files['package-lock.json'].encode()).hexdigest()}, indent=2))
print('PRODUCT_TREE', product['sha'], 'SOURCE_FILES', len(files))
print('No branch ref changed or release published. Temporary authoring transfer excluded from product tree.')
