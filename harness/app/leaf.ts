import { mountShowcase } from '../../src/bootstrap/mount-ui';
import type { Services } from '../../src/bootstrap/services';
import { bindViewHeader, SHOWCASE_VIEW } from '../../src/infrastructure/obsidian/view-header';
/** Deliberately synthetic frame. Only native-host tests qualify Obsidian DOM behavior. */
export function mountHarnessLeaf(workspace: HTMLElement, services: Services, id: string) {
  const frame = document.createElement('section');
  frame.className = 'harness-leaf'; frame.dataset.type = SHOWCASE_VIEW; frame.dataset.leaf = id;
  frame.setAttribute('aria-label', `Simulated plugin leaf ${id}`);
  const header = document.createElement('div'); header.className = 'view-header';
  header.textContent = `Native header simulation · ${services.identity.name}`;
  const root = document.createElement('div'); root.className = 'harness-plugin-root';
  if (id === 'primary') root.id = 'showcase-root';
  frame.append(header, root); workspace.append(frame);
  const restore = bindViewHeader(frame, services.preferences, services.diagnostics);
  let stop: (() => void) | undefined;
  try {
    stop = mountShowcase(root, services, () => services.host.showModal('Harness view actions (simulation)', 'The native plugin opens its owning Obsidian pane menu here, including header restoration, split, pop-out and close.'));
  } catch (error) { restore(); frame.remove(); throw error; }
  return { frame, close() { try { stop?.(); } finally { restore(); frame.remove(); } } };
}
