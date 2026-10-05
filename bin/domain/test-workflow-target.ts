import { hasPortableProjectSegments } from '../../scripts/shared/project-path.ts';
import { keys, object, text } from './data.ts';
import { hasControls, requireSketch } from './errors.ts';
/**
 * Where a workflow's app lives. Every target is offline or loopback-only:
 * - static: a project folder with index.html, served read-only by the runner on an ephemeral 127.0.0.1 port;
 * - prototype: a prepared prototype package whose prototype.manifest.json names its built offline HTML artifact;
 * - url: an app the developer already serves on loopback (for example a generated project's `npm start` preview).
 */
export type TestWorkflowTarget = { kind: 'static'; folder: string } | { kind: 'prototype'; package: string } | { kind: 'url'; url: string };
const loopbackHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);
function folderPath(value: unknown, name: string): string {
  const folder = text(value, name, 300).replace(/\/+$/, '');
  requireSketch(!hasControls(folder) && hasPortableProjectSegments(folder) && !folder.split('/').some(part => part === 'node_modules' || part.startsWith('.')), 'WORKFLOW_TARGET_PATH',
    `${name} must be a project-relative folder such as tests/fixtures/workflows/sign-up (no .., hidden or node_modules segments).`);
  return folder;
}
/** http only, a loopback host, an explicit port, and no credentials, query or fragment. */
export function readTestWorkflowUrl(value: unknown, name: string): string {
  const raw = text(value, name, 300);
  let url: URL | undefined;
  try { url = new URL(raw); } catch { url = undefined; }
  requireSketch(url && !hasControls(raw) && url.protocol === 'http:' && loopbackHosts.has(url.hostname) && url.port !== '' && !url.username && !url.password && !url.search && !url.hash,
    'WORKFLOW_TARGET_URL', `${name} must be a loopback http URL with a port, such as http://127.0.0.1:4173/; remote hosts are never contacted.`);
  return url.href;
}
export function readTestWorkflowTarget(value: unknown, name: string): TestWorkflowTarget {
  const item = object(value);
  if (item.kind === 'static') { keys(item, ['kind', 'folder']); return { kind: 'static', folder: folderPath(item.folder, name + '.folder') }; }
  if (item.kind === 'prototype') { keys(item, ['kind', 'package']); return { kind: 'prototype', package: folderPath(item.package, name + '.package') }; }
  requireSketch(item.kind === 'url', 'WORKFLOW_TARGET', `${name}.kind must be static, prototype or url.`);
  keys(item, ['kind', 'url']);
  return { kind: 'url', url: readTestWorkflowUrl(item.url, name + '.url') };
}
/** `--target` on the command line: a loopback URL, a prototypes/<slug> package or a static folder. */
export function testWorkflowTargetOverride(value: string): TestWorkflowTarget {
  if (/^[a-z]+:/i.test(value)) return readTestWorkflowTarget({ kind: 'url', url: value }, '--target');
  if (value.startsWith('prototypes/')) return readTestWorkflowTarget({ kind: 'prototype', package: value }, '--target');
  return readTestWorkflowTarget({ kind: 'static', folder: value }, '--target');
}
export function describeTestWorkflowTarget(target: TestWorkflowTarget): string {
  return target.kind === 'url' ? `url ${target.url}` : target.kind === 'static' ? `static ${target.folder}` : `prototype ${target.package}`;
}
