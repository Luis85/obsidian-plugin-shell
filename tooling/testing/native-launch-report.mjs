import { isDeepStrictEqual } from 'node:util';

const launchCheck = 'native-contained-config-fresh-launch-resource-snapshots';
const ownershipChecks = ['native-owned-notice-modal-expiry-timer-close-preserves-live-sibling-and-foreign-notice',
  'native-unload-releases-observed-plugin-handles-with-independent-zero-fault-ledger-and-retains-foreign-notice'];
const fail = () => { throw new Error('EVIDENCE_NATIVE_LAUNCH_RESOURCES'); };
const integer = value => Number.isSafeInteger(value) && value >= 0;
function shape(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || !isDeepStrictEqual(Object.keys(value).sort(), [...fields].sort())) fail();
}
function sample(value, phase) {
  shape(value, ['phase', 'sampledAt', 'boundary', 'classification', 'idleReference', 'platform', 'totalMemoryBytes',
    'freeMemoryBytes', 'availableParallelism', 'loadAverage', 'processMemory']);
  const time = typeof value.sampledAt === 'string' ? Date.parse(value.sampledAt) : NaN;
  if (value.phase !== phase || !Number.isFinite(time) || new Date(time).toISOString() !== value.sampledAt
    || value.boundary !== 'before-public-launch-call' || value.classification !== 'shared-runner' || value.idleReference !== false) fail();
  if (!['aix', 'android', 'cygwin', 'darwin', 'freebsd', 'haiku', 'linux', 'netbsd', 'openbsd', 'sunos', 'win32'].includes(value.platform)
    || !integer(value.totalMemoryBytes) || value.totalMemoryBytes === 0 || !integer(value.freeMemoryBytes)
    || value.freeMemoryBytes > value.totalMemoryBytes || !integer(value.availableParallelism) || value.availableParallelism === 0) fail();
  shape(value.processMemory, ['rss', 'heapUsed']);
  if (!integer(value.processMemory.rss) || value.processMemory.rss === 0 || !integer(value.processMemory.heapUsed)) fail();
  shape(value.loadAverage, ['supported', 'values', 'reason']);
  if (value.platform === 'win32') {
    if (!isDeepStrictEqual(value.loadAverage, { supported: false, values: null, reason: 'unsupported-on-win32' })) fail();
  } else if (value.loadAverage.supported !== true || value.loadAverage.reason !== null
    || !Array.isArray(value.loadAverage.values) || value.loadAverage.values.length !== 3
    || !value.loadAverage.values.every(value => Number.isFinite(value) && value >= 0)) fail();
  return time;
}
function cleanup(report, required) {
  if (report.cleanupFailures === undefined) {
    if (required && report.cleanupFailure != null) fail();
    return;
  }
  if (!Array.isArray(report.cleanupFailures)) fail();
  for (const entry of report.cleanupFailures) {
    shape(entry, ['code', 'message']);
    if (typeof entry.code !== 'string' || !entry.code || typeof entry.message !== 'string') fail();
  }
  if (report.cleanupFailures.length) {
    if (report.cleanupFailure !== report.cleanupFailures[0].code || report.status === 'passed') fail();
  } else if (report.cleanupFailure != null) fail();
}
function fixtureAssets(values) {
  if (!Array.isArray(values) || values.length !== 2) fail();
  if (!isDeepStrictEqual(values.map(value => value?.file).sort(), ['main.js', 'manifest.json'])) fail();
  for (const value of values) {
    shape(value, ['file', 'bytes', 'sha256']);
    if (!integer(value.bytes) || value.bytes === 0 || typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.sha256)) fail();
  }
  return [...values].sort((left, right) => left.file.localeCompare(right.file));
}
function foreignFixture(report, required) {
  if (report.foreignNoticeFixture === undefined) {
    if (required && report.status === 'passed') fail();
    return;
  }
  const value = report.foreignNoticeFixture;
  shape(value, ['id', 'assets', 'installedAssets']);
  if (value.id !== 'qualification-foreign-notice'
    || !isDeepStrictEqual(fixtureAssets(value.assets), fixtureAssets(value.installedAssets))) fail();
}

/** Validate diagnostic receipts without treating resource availability as idle/performance qualification. */
export function validateNativeLaunch(report, expectedChecks) {
  const required = expectedChecks.includes(launchCheck);
  cleanup(report, required || report.launchResources !== undefined);
  foreignFixture(report, required && ownershipChecks.some(check => expectedChecks.includes(check)));
  if (!required && report.launchResources === undefined) return;
  if (!Array.isArray(report.launchResources) || report.launchResources.length > 2
    || (report.status === 'passed' && report.launchResources.length !== 2)) fail();
  const phases = ['initial', 'cold-restart']; let previous = -Infinity; let platform;
  for (const [index, value] of report.launchResources.entries()) {
    const time = sample(value, phases[index]);
    if (time <= previous || (platform !== undefined && value.platform !== platform)) fail();
    previous = time; platform = value.platform;
  }
}
