import { readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { cpus, totalmem, platform, release, arch } from 'node:os';
import { performanceProtocol, summarizePerformance, candidateSizes } from './performance-report.mjs';
import { sourceInputs, sha256 } from './source-inputs.mjs';

/** Explicit scratch-vault fixture; ordinary persisted records, loaded by the real repository. */
function referenceItems() {
  return Array.from({ length: 100 }, (_, index) => ({ id: `reference-${index + 1}`, revision: 1,
    createdAt: '2026-09-23T00:00:00.000Z', values: { label: `Reference item ${String(index + 1).padStart(3, '0')}` } }));
}
export async function qualifyPerformance(page, report, output, vault, identity, classification) {
  const dataPath = join(vault, identity.pluginDirectory, 'data.json');
  let original;
  try { original = await readFile(dataPath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const inputs = await sourceInputs(process.cwd());
  const result = { schemaVersion: 1, mode: 'native-obsidian', status: 'running', classification,
    protocol: performanceProtocol, protocolSha256: sha256(JSON.stringify(performanceProtocol)),
    sourceCommit: report.sourceCommit, sourceInputsDigest: inputs.digest, dependencyLockSha256: sha256(await readFile('package-lock.json')),
    driverInputs: inputs.files.filter(file => file.path.startsWith('scripts/testing/native-') || file.path === 'scripts/testing/check-native.mjs' || file.path === 'scripts/testing/performance-report.mjs'),
    environment: { platform: platform(), release: release(), arch: arch(), cpus: cpus().map(cpu => cpu.model), totalMemory: totalmem(),
      node: process.version, playwright: JSON.parse(await readFile('node_modules/@playwright/test/package.json', 'utf8')).version,
      host: report.resolvedVersions, launcher: report.launcherVersion, userAgent: await page.evaluate(() => navigator.userAgent),
      viewport: await page.evaluate(() => ({ width: innerWidth, height: innerHeight, devicePixelRatio, visibility: document.visibilityState })),
      isolation: classification === 'controlled-reference' ? 'Operator explicitly requested an otherwise idle reference host; no claim of automatic process isolation.' : 'Shared-runner diagnostic; timing budgets are advisory.' },
    assets: report.assets, samples: [], sizes: await candidateSizes('dist') };
  report.performance = result;
  const retain = () => writeFile(join(output, 'performance.json'), JSON.stringify(result, null, 2));
  await retain();
  try {
    await page.evaluate(async id => window.app.plugins.disablePlugin(id), identity.id);
    const base = original ? JSON.parse(original.toString('utf8')) : { schemaVersion: 1, preferences: { locale: 'en', taskFolder: 'Tasks', notifySuccess: true, hideObsidianViewHeader: false } };
    const fixture = { ...base, pluginEntities: { schemaVersion: 1, collections: { ...base.pluginEntities?.collections,
      item: { schemaVersion: 1, revision: 100, records: referenceItems() } } } };
    const bytes = JSON.stringify(fixture); result.fixtureSha256 = sha256(bytes); await writeFile(dataPath, bytes);
    for (const kind of Object.keys(performanceProtocol.budgets)) {
      for (let index = 0; index < performanceProtocol.warmups + performanceProtocol.samples; index++) {
        if (kind === 'warm-initialization') await page.evaluate(async id => window.app.plugins.disablePlugin(id), identity.id);
        const sample = await page.evaluate(async ({ kind, index, warmups, id, viewType, labels }) => {
          const row = { kind, index, warmup: index < warmups, startMs: performance.now(), endMs: 0, durationMs: 0, status: 'failed' };
          let leaf;
          try {
            const app = window.app;
            if (document.visibilityState !== 'visible') throw new Error('PERFORMANCE_WINDOW_NOT_VISIBLE');
            if (kind === 'warm-initialization') {
              await app.plugins.enablePlugin(id);
              const runtime = app.plugins.plugins[id]?.runtime;
              if (!runtime || runtime.diagnosticSnapshot().length || !app.commands.commands[`${id}:open-showcase`]) throw new Error('PERFORMANCE_RUNTIME_NOT_READY');
            } else {
              leaf = app.workspace.getLeaf('tab'); await leaf.setViewState({ type: viewType, active: true });
              const root = leaf.view.containerEl;
              const documents = Array.from(root.querySelectorAll('button')).find(button => button.textContent.trim() === 'Documents');
              if (!documents) throw new Error('PERFORMANCE_DOCUMENTS_MISSING'); documents.click();
              await new Promise((resolve, reject) => {
                let frame; const timeout = setTimeout(() => { cancelAnimationFrame(frame); reject(new Error('PERFORMANCE_ITEMS_TIMEOUT')); }, 15000);
                const inspect = () => {
                  const panel = root.querySelector('[data-testid="items-repository"]');
                  const actual = panel ? Array.from(panel.querySelectorAll('li strong')).map(row => row.textContent) : [];
                  if (panel?.getAttribute('aria-busy') === 'false' && JSON.stringify(actual) === JSON.stringify(labels)) {
                    frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => { clearTimeout(timeout); resolve(); }); });
                  } else frame = requestAnimationFrame(inspect);
                }; inspect();
              });
              if (app.plugins.plugins[id].runtime.diagnosticSnapshot().length) throw new Error('PERFORMANCE_RENDER_DIAGNOSTICS');
            }
            row.status = 'passed';
          } catch (error) { row.error = String(error.message).slice(0, 300); }
          finally {
            row.endMs = performance.now(); row.durationMs = row.endMs - row.startMs;
            try { leaf?.detach(); } catch (error) { row.status = 'failed'; row.error = `PERFORMANCE_LEAF_CLEANUP:${String(error.message).slice(0, 300)}`; }
          }
          return row;
        }, { kind, index, warmups: performanceProtocol.warmups, id: identity.id, viewType: identity.viewType, labels: referenceItems().map(row => row.values.label) })
          .catch(error => ({ kind, index, warmup: index < performanceProtocol.warmups, status: 'failed', startMs: null, endMs: null, durationMs: null,
            error: `PERFORMANCE_RENDERER_UNAVAILABLE:${String(error.message).slice(0, 300)}` }));
        result.samples.push(sample); await retain();
        if (sample.status !== 'passed') throw new Error('PERFORMANCE_SAMPLE_FAILED');
      }
    }
    result.summary = summarizePerformance(result.samples);
    if ((await sourceInputs(process.cwd())).digest !== inputs.digest) throw new Error('PERFORMANCE_SOURCE_CHANGED');
    if (result.sizes.status !== 'passed') throw new Error('PERFORMANCE_ASSET_SIZE');
    if (result.sizes.serializerAttribution.status !== 'measured') throw new Error('PERFORMANCE_ATTRIBUTION_MISSING');
    result.budgetStatus = result.summary.every(metric => metric.withinProposedBudget) ? 'within-proposed-budgets' : 'exceeds-proposed-budgets';
    result.status = 'passed';
  } catch (error) { result.status = 'failed'; result.reason = String(error.message); throw error; }
  finally {
    try {
      await page.evaluate(async id => window.app.plugins.disablePlugin(id), identity.id);
      if (original) await writeFile(dataPath, original); else await rm(dataPath, { force: true });
      await page.evaluate(async id => window.app.plugins.enablePlugin(id), identity.id);
    } catch (error) { result.status = 'failed'; result.cleanupFailure = String(error.message); }
    await retain();
    if (result.cleanupFailure) throw new Error('PERFORMANCE_RESTORE_FAILED');
  }
}
