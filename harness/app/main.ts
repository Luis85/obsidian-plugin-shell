import { createServices } from '../../src/bootstrap/services';
import { mountShowcase } from '../../src/bootstrap/mount-ui';
import { browserAdapters } from './adapters';
import '../../src/styles/app.css';
import './frame.css';
const adapter = browserAdapters();
const services = await createServices(adapter.adapters);
const root = document.getElementById('showcase-root');
if (!root) throw new Error('MISSING_ROOT');
const close = mountShowcase(root, services);
for (const mode of ['light', 'dark']) document.getElementById(`theme-${mode}`)?.addEventListener('click', () => {
  document.body.classList.toggle('theme-dark', mode === 'dark'); document.body.classList.toggle('theme-light', mode === 'light');
});
let second: { root: HTMLElement; close: () => void } | undefined;
const closeSecond = () => { second?.close(); second?.root.remove(); second = undefined; };
const testApi = {
  mountSecond() { if (second) return; const element = document.createElement('div'); document.body.append(element); second = { root: element, close: mountShowcase(element, services) }; },
  closeSecond, resourceCount: () => services.events.size, files: adapter.files, faults: adapter.errors, fault: adapter.fault, dispose: () => { closeSecond(); close(); services.dispose(); adapter.dispose(); } };
Object.assign(window, { __SHELL_TEST__: testApi });
document.documentElement.dataset.ready = 'true';
if (import.meta.hot) import.meta.hot.dispose(testApi.dispose);
