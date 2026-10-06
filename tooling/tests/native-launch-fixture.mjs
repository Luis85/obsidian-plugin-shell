/** Synthetic schema fixture only; never a claim of native launch or resource availability. */
export function nativeLaunchFixture(platform = 'linux') {
  return { launchResources: ['initial', 'cold-restart'].map((phase, index) => ({
    phase, sampledAt: `2026-09-24T12:00:0${index}.000Z`, boundary: 'before-public-launch-call',
    classification: 'shared-runner', idleReference: false, platform,
    totalMemoryBytes: 16_000_000_000, freeMemoryBytes: 4_000_000_000, availableParallelism: 4,
    loadAverage: platform === 'win32' ? { supported: false, values: null, reason: 'unsupported-on-win32' }
      : { supported: true, values: [0.5, 1, 2], reason: null },
    processMemory: { rss: 80_000_000, heapUsed: 20_000_000 },
  })) };
}
export function nativeForeignNoticeFixture() {
  const assets = [{ file: 'main.js', bytes: 500, sha256: 'b'.repeat(64) }, { file: 'manifest.json', bytes: 200, sha256: 'c'.repeat(64) }];
  return { foreignNoticeFixture: { id: 'qualification-foreign-notice', assets, installedAssets: structuredClone(assets) } };
}
