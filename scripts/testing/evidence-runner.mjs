import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { evidenceIdentity, assetIdentity, suiteInventory, fileIdentity, candidateIdentity } from './evidence-identity.mjs';
import { producerCommand, adaptProducer } from './evidence-producers.mjs';

async function execute(root, args, output, candidate, timeoutMs) {
  return await new Promise(resolve => {
    const env = { ...process.env, TZ: 'UTC', LANG: 'C.UTF-8', NODE_OPTIONS: '', FORCE_COLOR: '0', SHELL_EVIDENCE_OUTPUT: output };
    delete env.NODE_TEST_CONTEXT;
    for (const key of Object.keys(env)) if (key.startsWith('PLAYWRIGHT_JSON_OUTPUT')) delete env[key];
    if (candidate) env.GITHUB_SHA = candidate.sourceCommit;
    const child = spawn(process.execPath, args, { cwd: root, env, shell: false, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = ''; let failure = null;
    // Heavy suites have their own assertion deadlines; this only bounds a stuck
    // producer and targets the owned process tree, never unrelated host processes.
    const stop = () => {
      if (!child.pid) return;
      if (process.platform === 'win32') {
        const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { shell: false, stdio: 'ignore' });
        killer.on('error', () => child.kill());
      } else {
        try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
      }
    };
    const timer = setTimeout(() => { failure = 'EVIDENCE_TIMEOUT'; stop(); }, timeoutMs);
    const append = (channel, chunk) => {
      if (stdout.length + stderr.length + chunk.length > 32_000_000) { failure = 'EVIDENCE_OUTPUT_LIMIT'; stop(); return; }
      if (channel === 'stdout') stdout += chunk.toString(); else stderr += chunk.toString();
    };
    child.stdout.on('data', chunk => append('stdout', chunk)); child.stderr.on('data', chunk => append('stderr', chunk));
    child.on('error', error => { failure = error.code ?? 'EVIDENCE_SPAWN'; });
    child.on('close', (exitCode, signal) => { clearTimeout(timer); resolve({ exitCode, signal, failure, stdout, stderr }); });
  });
}
export async function runEvidence(root, producer, { allowDownload = false, candidate: suppliedCandidate, timeoutMs = 30 * 60 * 1000 } = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30 * 60 * 1000) throw new Error('EVIDENCE_TIMEOUT_POLICY');
  if (producer === 'native' && !allowDownload) throw new Error('EVIDENCE_NATIVE_REQUIRES_ALLOW_DOWNLOAD');
  const before = await evidenceIdentity(root, producer);
  const suites = await suiteInventory(root, producer);
  if (!suites.length) throw new Error('EVIDENCE_EMPTY_INVENTORY');
  const assets = ['native', 'artifact', 'browser'].includes(producer) ? await assetIdentity(root) : [];
  const candidate = producer === 'native' ? await candidateIdentity(root, before, suppliedCandidate) : null;
  const id = randomUUID(); const session = join(root, 'reports/evidence', before.sourceDigest);
  const output = join(session, id);
  await mkdir(output, { recursive: true });
  // Register before execution: interrupted, missing and failed runs cannot vanish
  // by selecting a later passing packet when reconciling the session.
  await appendFile(join(session, 'runs.jsonl'), JSON.stringify({ id, producer, sourceDigest: before.sourceDigest }) + '\n');
  const retained = { coverage: 'reports/production-coverage/coverage-summary.json', native: 'reports/native/report.json' }[producer];
  if (retained) {
    try { await rename(join(root, retained), join(output, 'previous-report.json')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const startedAt = new Date().toISOString();
  const args = producerCommand(root, producer, suites, output);
  const execution = await execute(root, args, output, candidate, timeoutMs);
  const raw = { stdout: execution.stdout, stderr: execution.stderr };
  const rawPaths = {};
  let result = null; let failure = execution.failure;
  try {
    if (['runtime', 'coverage'].includes(producer)) raw.framework = await readFile(join(output, 'framework.json'), 'utf8');
    if (['runtime', 'coverage'].includes(producer)) raw.attempts = await readFile(join(output, 'attempts.json'), 'utf8');
    if (retained) raw[producer] = await readFile(join(root, retained), 'utf8');
    result = await adaptProducer(producer, raw, root, suites, execution.exitCode);
  } catch (error) { failure ??= error.message; }
  for (const [kind, text] of Object.entries(raw)) {
    const file = `raw-${kind}.txt`; await writeFile(join(output, file), text);
    rawPaths[kind] = await fileIdentity(output, file);
  }
  const after = await evidenceIdentity(root, producer);
  const finalAssets = assets.length ? await assetIdentity(root) : [];
  if (JSON.stringify(before) !== JSON.stringify(after)) failure = 'EVIDENCE_SOURCE_CHANGED';
  if (JSON.stringify(assets) !== JSON.stringify(finalAssets)) failure = 'EVIDENCE_ASSETS_CHANGED';
  if (result?.assets && result.assets.some(asset => !assets.some(expected => expected.file === asset.file && expected.sha256 === asset.sha256 && (asset.bytes === undefined || expected.bytes === asset.bytes)))) failure = 'EVIDENCE_ASSET_MISMATCH';
  if (candidate && result?.candidateSource !== candidate.sourceCommit) failure = 'EVIDENCE_CANDIDATE_SOURCE';
  const packet = { schemaVersion: 1, producer, id, startedAt, finishedAt: new Date().toISOString(), before, after,
    suites, assets, candidate, execution: { exitCode: execution.exitCode, signal: execution.signal, retry: 0, repetition: 0 },
    raw: rawPaths, result, failure, status: !failure && result?.status === 'passed' ? 'passed' : 'failed' };
  await writeFile(join(output, 'packet.json'), JSON.stringify(packet, null, 2) + '\n', { flag: 'wx' });
  return { packet, path: join(output, 'packet.json') };
}
