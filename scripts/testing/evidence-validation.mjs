import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { object } from './evidence-adapters.mjs';
import { evidenceIdentity, assetIdentity, fileIdentity, suiteInventory, candidateIdentity } from './evidence-identity.mjs';
import { adaptProducer } from './evidence-producers.mjs';

const equal = (left, right, code) => { if (JSON.stringify(left) !== JSON.stringify(right)) throw new Error(code); };
export async function checkEvidence(root, path) {
  const packet = JSON.parse(await readFile(path, 'utf8'));
  object(packet, ['schemaVersion', 'producer', 'id', 'startedAt', 'finishedAt', 'before', 'after', 'suites', 'assets', 'candidate', 'execution', 'raw', 'result', 'failure', 'status']);
  if (packet.schemaVersion !== 1 || !/^[0-9a-f-]{36}$/.test(packet.id) || !Number.isFinite(Date.parse(packet.startedAt)) || !Number.isFinite(Date.parse(packet.finishedAt)) || Date.parse(packet.finishedAt) < Date.parse(packet.startedAt)) throw new Error('EVIDENCE_SCHEMA');
  object(packet.execution, ['exitCode', 'signal', 'retry', 'repetition']);
  if (packet.execution.retry !== 0 || packet.execution.repetition !== 0) throw new Error('EVIDENCE_ATTEMPT');
  const current = await evidenceIdentity(root, packet.producer);
  equal(packet.before, packet.after, 'EVIDENCE_SOURCE_CHANGED');
  equal(packet.before, current, 'EVIDENCE_STALE');
  equal(packet.suites, await suiteInventory(root, packet.producer), 'EVIDENCE_SUITE_INVENTORY');
  equal(packet.assets, ['native', 'artifact', 'browser'].includes(packet.producer) ? await assetIdentity(root) : [], 'EVIDENCE_ASSET_MISMATCH');
  equal(packet.candidate, packet.producer === 'native' ? await candidateIdentity(root, current, packet.candidate?.directory) : null, 'EVIDENCE_CANDIDATE_MISMATCH');
  const keys = ['stdout', 'stderr', ...(['runtime', 'coverage'].includes(packet.producer) ? ['framework', 'attempts'] : []), ...(['coverage', 'native'].includes(packet.producer) ? [packet.producer] : [])];
  object(packet.raw, keys);
  equal(Object.keys(packet.raw).sort(), keys.sort(), 'EVIDENCE_RAW_INVENTORY');
  const raw = {};
  for (const [kind, identity] of Object.entries(packet.raw)) {
    object(identity, ['file', 'bytes', 'sha256']);
    if (identity.file !== `raw-${kind}.txt`) throw new Error('EVIDENCE_RAW_PATH');
    equal(identity, await fileIdentity(dirname(path), identity.file), 'EVIDENCE_RAW_HASH');
    raw[kind] = await readFile(join(dirname(path), identity.file), 'utf8');
  }
  const actual = await adaptProducer(packet.producer, raw, root, packet.suites, packet.execution.exitCode);
  if (packet.candidate && actual.candidateSource !== packet.candidate.sourceCommit) throw new Error('EVIDENCE_CANDIDATE_SOURCE');
  equal(packet.result, actual, 'EVIDENCE_RESULT_MISMATCH');
  if (actual.assets && (actual.assets.length !== packet.assets.length || actual.assets.some(asset => !packet.assets.some(expected => expected.file === asset.file && expected.sha256 === asset.sha256 && (asset.bytes === undefined || asset.bytes === expected.bytes))))) throw new Error('EVIDENCE_ASSET_MISMATCH');
  if (packet.failure !== null || packet.status !== 'passed' || actual.status !== 'passed' || packet.execution.exitCode !== 0 || packet.execution.signal !== null) throw new Error('EVIDENCE_NOT_PASSING');
  return packet;
}
export async function checkSession(root, directory) {
  const text = await readFile(join(directory, 'runs.jsonl'), 'utf8');
  const runs = text.trim().split('\n').map(line => JSON.parse(line));
  if (!runs.length || !text.endsWith('\n')) throw new Error('EVIDENCE_SESSION_INCOMPLETE');
  for (const run of runs) {
    object(run, ['id', 'producer', 'sourceDigest']);
    if (!/^[0-9a-f-]{36}$/.test(run.id) || !/^[0-9a-f]{64}$/.test(run.sourceDigest)) throw new Error('EVIDENCE_SESSION_SCHEMA');
  }
  if (new Set(runs.map(run => run.id)).size !== runs.length || new Set(runs.map(run => run.sourceDigest)).size !== 1) throw new Error('EVIDENCE_SESSION_DUPLICATE');
  const entries = await readdir(directory, { withFileTypes: true });
  equal(entries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort(), runs.map(run => run.id).sort(), 'EVIDENCE_SESSION_INVENTORY');
  if (entries.some(entry => entry.isSymbolicLink() || (entry.isFile() && entry.name !== 'runs.jsonl'))) throw new Error('EVIDENCE_SESSION_INVENTORY');
  const packets = []; const errors = []; const outcomes = new Map();
  for (const run of runs) {
    try {
      const packet = await checkEvidence(root, resolve(directory, run.id, 'packet.json'));
      if (packet.id !== run.id || packet.producer !== run.producer || packet.before.sourceDigest !== run.sourceDigest) throw new Error('EVIDENCE_SESSION_BINDING');
      // Repetition compares semantic case outcomes, never timing, IDs or report
      // paths. Complete file coverage alone cannot detect selective registration.
      const cases = packet.result.cases.map(test => ({ file: test.file, name: test.name, mode: test.mode,
        status: test.status, attempt: test.attempt, repetition: test.repetition }))
        .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
      const outcome = JSON.stringify({ cases, counts: packet.result.counts });
      if (outcomes.has(packet.producer) && outcomes.get(packet.producer) !== outcome) throw new Error('EVIDENCE_REPEAT_OUTCOME_DRIFT');
      outcomes.set(packet.producer, outcome);
      packets.push(packet);
    } catch (error) { errors.push({ id: run.id, producer: run.producer, error: error.message }); }
  }
  return { packets, errors, totalRuns: runs.length, status: errors.length ? 'failed' : 'passed' };
}
