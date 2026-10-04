import { createServer } from 'node:http';
import { join } from 'node:path';
import { parseJsonData } from '../../scripts/contracts/json-data.ts';
import { hasPortableProjectSegments } from '../../scripts/shared/project-path.ts';
import { getPath } from '../domain/form-model.ts';
import type { TestWorkflowTarget } from '../domain/test-workflow-target.ts';
import { readBounded } from './framework/files.ts';
import { previewAssets } from './first-run-preview.ts';
import { guardedText } from './user-settings.ts';
/** What a run can open: in-memory assets served on loopback, an already running loopback app, or nothing yet. */
export type TestWorkflowServable =
  | { kind: 'assets'; assets: Map<string, { bytes: Buffer; type: string }>; entry: string; source: string }
  | { kind: 'url'; url: string; source: string }
  | { kind: 'unavailable'; reason: string; source: string };
const manifestFile = 'prototype.manifest.json';
/** The built offline HTML a prepared prototype package names, or why there is none yet. */
async function prototypeArtifact(root: string, folder: string): Promise<{ path?: string; reason?: string }> {
  const manifest = await guardedText(root, `${folder}/${manifestFile}`);
  if (manifest.content === null) return { reason: `${folder}/${manifestFile} does not exist; prepare the package with node bin/app prototype --out ${folder}.` };
  const artifact = getPath(parseJsonData(manifest.content), 'artifact.path');
  if (typeof artifact !== 'string' || !hasPortableProjectSegments(artifact) || !artifact.endsWith('.html'))
    return { reason: `${folder}/${manifestFile} names no offline HTML artifact (artifact.path); a CLI-only prototype has nothing to open in a browser.` };
  const built = await guardedText(root, `${folder}/${artifact}`);
  return built.content === null ? { reason: `${folder}/${artifact} is not built yet; follow the package README to build it.` } : { path: `${folder}/${artifact}` };
}
/** Findings for `workflow check`: a missing static folder is an error; an unbuilt prototype or an unprobed URL is a warning. */
export async function testWorkflowTargetState(root: string, target: TestWorkflowTarget): Promise<{ issues: Array<{ code: string; message: string }>; warnings: string[] }> {
  if (target.kind === 'url') return { issues: [], warnings: [`Target ${target.url} is not probed by check; start it before workflow run.`] };
  if (target.kind === 'prototype') {
    const artifact = await prototypeArtifact(root, target.package);
    return { issues: [], warnings: artifact.reason ? [`Not runnable yet: ${artifact.reason}`] : [] };
  }
  const index = await guardedText(root, `${target.folder}/index.html`);
  return index.content === null ? { issues: [{ code: 'WORKFLOW_TARGET_MISSING', message: `Static target ${target.folder}/index.html does not exist.` }], warnings: [] } : { issues: [], warnings: [] };
}
/** Static folders are read into memory with the first-run preview limits (no symlinks, bounded size, known media types). */
export async function testWorkflowServable(root: string, target: TestWorkflowTarget): Promise<TestWorkflowServable> {
  if (target.kind === 'url') return { kind: 'url', url: target.url, source: target.url };
  if (target.kind === 'static') return { kind: 'assets', assets: await previewAssets(join(root, target.folder)), entry: '/', source: target.folder };
  const artifact = await prototypeArtifact(root, target.package);
  if (!artifact.path) return { kind: 'unavailable', reason: artifact.reason!, source: target.package };
  const page = { bytes: await readBounded(join(root, artifact.path), 64_000_000), type: 'text/html; charset=utf-8' };
  return { kind: 'assets', assets: new Map([['/index.html', page]]), entry: '/', source: artifact.path };
}
export interface TestWorkflowServer { url: string; close(): Promise<void> }
/** Read-only GET/HEAD server on 127.0.0.1 with an ephemeral port; the Host header must name exactly that address. */
export async function serveTestWorkflowAssets(assets: Map<string, { bytes: Buffer; type: string }>): Promise<TestWorkflowServer> {
  let address = '';
  const server = createServer((request, response) => {
    let path: string;
    try { path = decodeURIComponent(new URL(request.url ?? '/', 'http://local').pathname); } catch { response.writeHead(400).end(); return; }
    const asset = assets.get(path === '/' ? '/index.html' : path);
    if (request.headers.host !== address || !['GET', 'HEAD'].includes(request.method ?? '') || !asset) { response.writeHead(404).end(); return; }
    response.writeHead(200, { 'content-type': asset.type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'content-length': asset.bytes.length });
    response.end(request.method === 'HEAD' ? undefined : asset.bytes);
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const bound = server.address();
  address = `127.0.0.1:${bound && typeof bound === 'object' ? bound.port : 0}`;
  return { url: `http://${address}/`, close: () => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); }) };
}
