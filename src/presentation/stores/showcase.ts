import { ref, shallowRef, reactive, onScopeDispose } from 'vue';
import { defineStore } from 'pinia';
import { useServices } from '../context/use-services';
import type { Failure } from '../../domain/outcome';
import type { TaskInput } from '../../features/tasks/form';
import type { PreparedDocument, DocumentReceipt } from '../../application/document-service';
import { useViewPreferences } from '../composables/use-view-preferences';
export const pages = ['overview', 'documents', 'events', 'settings'] as const;
type Page = typeof pages[number];
export const useShowcase = defineStore('showcase', () => {
  const services = useServices();
  const viewPreferences = useViewPreferences();
  const owner = viewPreferences.owner;
  const draft = reactive({ title: '', due: '', tags: '' });
  const ownedFeedback = () => services.notifications.current.filter(item => (item.owner.startsWith(`${owner}:`) || item.scope === 'runtime') && !item.native && item.visible !== false);
  const page = ref<Page>('overview');
  try { const stored = services.local.get('page'); if (pages.includes(stored as Page)) page.value = stored as Page; }
  catch { services.diagnostics.report('local.read', 'preferences.local'); }
  const preferences = viewPreferences.preferences;
  const feedback = shallowRef(ownedFeedback());
  const diagnostics = shallowRef(services.diagnostics.current);
  const stream = ref<{ sequence: number; type: string }[]>([]);
  const createdCount = ref(0);
  const eventCount = ref(0);
  const prepared = shallowRef<PreparedDocument>();
  const receipt = shallowRef<DocumentReceipt>();
  const error = shallowRef<Failure>();
  const busy = ref(false);
  const opening = ref(false);
  let alive = true;
  const record = (type: string) => { eventCount.value++; stream.value = [{ sequence: eventCount.value, type }, ...stream.value].slice(0, 30); };
  const stops = [
    services.notifications.subscribe(() => { feedback.value = ownedFeedback(); }),
    services.diagnostics.subscribe(() => { diagnostics.value = services.diagnostics.current; }),
    services.events.on('showcase.ping', () => record('showcase.ping')),
    services.events.on('documents.created', () => { createdCount.value++; record('documents.created'); }),
    services.events.on('preferences.changed', () => record('preferences.changed')),
    services.events.on('host.active-file-changed', () => record('host.active-file-changed')),
    ...(['documents.updated', 'documents.deleted', 'host.vault.entry-created', 'host.vault.entry-modified', 'host.vault.entry-renamed',
      'host.vault.entry-deleted', 'host.workspace.file-opened', 'host.workspace.active-view-changed', 'host.workspace.layout-changed',
      'host.metadata.changed'] as const).map(type => services.events.on(type, () => record(type))),
  ];
  onScopeDispose(() => { alive = false; if (prepared.value) services.documents.discard(prepared.value); for (const stop of stops) stop(); for (const item of services.notifications.current) { if (item.owner.startsWith(`${owner}:`)) services.notifications.dismiss(item.id); } });
  function navigate(next: Page) {
    page.value = next;
    try { services.local.set('page', next); } catch { services.diagnostics.report('local.write', 'preferences.local'); }
  }
  function preview(input: TaskInput) {
    if (busy.value || error.value?.effect === 'uncertain') return;
    if (prepared.value) services.documents.discard(prepared.value);
    error.value = undefined; receipt.value = undefined;
    const result = services.documents.prepare('task', input, preferences.value.taskFolder, services.newId());
    if (result.ok) prepared.value = result.value; else { error.value = result.error; prepared.value = undefined; }
  }
  async function commit() {
    if (!prepared.value || busy.value) return;
    busy.value = true; error.value = undefined;
    try {
      const result = await services.documents.commit(prepared.value, services.preferences.current.taskFolder);
      if (!alive) return;
      if (result.ok) {
        receipt.value = result.value;
        try { services.notifications.show(`${owner}:document-create`, 'success', 'feedback.saved', preferences.value.notifySuccess); }
        catch { services.diagnostics.report('notice.unexpected', 'notice.show'); }
      } else error.value = result.error;
    } catch { services.diagnostics.report('document.unexpected', 'document.create'); if (!alive) return; error.value = { code: 'unexpected', key: 'error.unexpected', effect: 'uncertain' }; }
    finally { if (alive) busy.value = false; }
  }
  async function openCreated() {
    const current = receipt.value;
    if (!alive || !current || opening.value) return;
    opening.value = true; error.value = undefined;
    try {
      const result = await services.host.openDocument(current.path);
      if (alive && receipt.value === current && !result.ok) error.value = { ...result.error, effect: 'committed' };
    } catch { if (alive && receipt.value === current) error.value = { code: 'unexpected', key: 'error.open', effect: 'committed' }; services.diagnostics.report('document.open', 'document.open'); }
    finally { if (alive) opening.value = false; }
  }
  function reset() { if (!busy.value && error.value?.effect !== 'uncertain') { if (prepared.value) services.documents.discard(prepared.value); prepared.value = undefined; receipt.value = undefined; error.value = undefined; } }
  return { owner, draft, page, navigate, preferences, feedback, diagnostics, stream, createdCount, eventCount, prepared, receipt, error, busy, opening, preview, commit, openCreated, reset };
});
