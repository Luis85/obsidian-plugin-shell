import { ref, shallowRef, reactive, onScopeDispose, useId, nextTick } from 'vue';
import type { TaskValues } from '../../features/tasks/entity';
import { createActionScope, type OperationPermit, type NoteSnapshot, type Failure } from '../../features/api';
import { useServices } from '../context/use-services';

export function useTaskRepository() {
  const services = useServices();
  const repository = services.repositories.task;
  const uid = useId();
  const notes = shallowRef<readonly NoteSnapshot<TaskValues>[]>([]);
  const selected = shallowRef<NoteSnapshot<TaskValues>>();
  const error = shallowRef<Failure>();
  const busy = ref(false);
  const blocked = ref(false);
  const loaded = ref(false);
  const confirming = ref(false);
  const message = ref('');
  const draft = reactive({ title: '', status: 'todo', due: '', tags: '' });
  const form = ref<HTMLFormElement>();
  const scope = createActionScope();
  let folder = services.preferences.current.taskFolder;
  const off = services.preferences.subscribe(value => {
    if (folder === value.taskFolder) return;
    folder = value.taskFolder; scope.invalidate(); notes.value = []; selected.value = undefined;
    loaded.value = false; blocked.value = false; confirming.value = false; message.value = ''; error.value = undefined;
  });
  onScopeDispose(() => { scope.dispose(); off(); });
  function select(note: NoteSnapshot<TaskValues>) {
    selected.value = note; error.value = undefined; confirming.value = false; message.value = '';
    Object.assign(draft, { ...note.values, due: note.values.due ?? '', tags: note.values.tags.join(', ') });
  }
  function edit(note: NoteSnapshot<TaskValues>) {
    if (scope.active() && !busy.value && !blocked.value) select(note);
  }
  function failed(value: Failure) {
    error.value = value;
    if (value.effect === 'uncertain') blocked.value = true;
  }
  async function run(operation: (permit: OperationPermit) => Promise<void>) {
    if (!scope.active() || busy.value) return;
    const permit = scope.capture();
    busy.value = true; error.value = undefined; message.value = '';
    try { await operation(permit); }
    catch {
      services.diagnostics.report('repository.unexpected', 'repository.action');
      if (permit.active()) failed({ code: 'unexpected', key: 'error.unexpected', effect: 'uncertain' });
    } finally { if (scope.active()) busy.value = false; }
  }
  async function reload() {
    await run(async permit => {
      const result = await repository.list();
      if (!permit.active()) return;
      if (!result.ok) { failed(result.error); return; }
      notes.value = result.value; loaded.value = true; blocked.value = false; selected.value = undefined; confirming.value = false;
    });
  }
  async function save() {
    const snapshot = selected.value;
    if (!snapshot || blocked.value) return;
    await run(async permit => {
      const status = draft.status;
      if (status !== 'todo' && status !== 'doing' && status !== 'done') return;
      const result = await repository.update(snapshot, { title: draft.title, status,
        due: draft.due || undefined, tags: draft.tags.split(',').map(value => value.trim()).filter(Boolean) }, permit);
      if (!permit.active()) return;
      if (!result.ok) {
        failed(result.error);
        await nextTick();
        if (permit.active() && result.error.field) form.value?.querySelector<HTMLInputElement>(`[name="edit-${result.error.field}"]`)?.focus();
        return;
      }
      notes.value = notes.value.map(note => note.path === snapshot.path ? result.value : note);
      select(result.value); message.value = 'repo.saved';
    });
  }
  async function remove() {
    const snapshot = selected.value;
    if (!snapshot || !confirming.value || blocked.value) return;
    await run(async permit => {
      const result = await repository.delete(snapshot, permit);
      if (!permit.active()) return;
      if (!result.ok) { failed(result.error); return; }
      notes.value = notes.value.filter(note => note.path !== snapshot.path);
      selected.value = undefined; confirming.value = false; message.value = 'repo.deleted';
    });
  }
  return { uid, notes, selected, error, busy, blocked, loaded, confirming, message, draft, form, edit, reload, save, remove };
}
