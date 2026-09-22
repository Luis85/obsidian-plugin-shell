import { createServices } from '../../src/bootstrap/services';
import { browserAdapters } from './adapters';
import { mountHarnessLeaf } from './leaf';
import type { HarnessApi } from './test-api';
import '../../src/styles/app.css';
import './frame.css';
const adapter = browserAdapters();
const services = await createServices(adapter.adapters);
const workspace = document.getElementById('harness-workspace');
if (!workspace) throw new Error('MISSING_WORKSPACE');
const primary = mountHarnessLeaf(workspace, services, 'primary');
const listeners: (() => void)[] = [];
for (const mode of ['light', 'dark']) {
  const button = document.getElementById(`theme-${mode}`);
  const change = () => {
    document.body.classList.toggle('theme-dark', mode === 'dark'); document.body.classList.toggle('theme-light', mode === 'light');
  };
  button?.addEventListener('click', change); listeners.push(() => button?.removeEventListener('click', change));
}
let second: ReturnType<typeof mountHarnessLeaf> | undefined;
const closeSecond = () => { second?.close(); second = undefined; };
let disposed = false;
const testApi: HarnessApi = {
  mountSecond() { if (!second && !disposed) second = mountHarnessLeaf(workspace, services, 'secondary'); },
  closeSecond,
  resourceCount: () => services.events.size, files: adapter.files, faults: adapter.errors, fault: adapter.fault,
  leafWidth(width) { primary.frame.style.flex = width === undefined ? '' : 'none'; primary.frame.style.width = width === undefined ? '' : `${width}px`; },
  async setPreferences(patch) { return (await services.preferences.update(patch)).ok; },
  async toggleHeader() { return (await services.preferences.toggleViewHeader()).ok; },
  dispose() {
    if (disposed) return; disposed = true;
    try { closeSecond(); primary.close(); } finally { listeners.forEach(stop => stop()); services.dispose(); adapter.dispose(); }
  },
};
Object.assign(window, { __SHELL_TEST__: testApi });
document.documentElement.dataset.ready = 'true';
if (import.meta.hot) import.meta.hot.dispose(testApi.dispose);
