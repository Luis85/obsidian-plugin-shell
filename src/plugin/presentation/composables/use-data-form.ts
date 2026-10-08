import { computed, nextTick, ref, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import { assignAt, valueAt, type DataFormDefinition, type DataFormField, type DataFormValue, type DataFormValues } from '../../domain/forms/model';
import { allDataFormNodes, readDataFormValue, visibleDataFormNodes, type DataFormNode } from '../../domain/forms/values';
import { useDataFormDrafts, type DataFormDraft } from '../stores/data-form-drafts';

export interface DataFormProps {
  readonly definition: DataFormDefinition;
  readonly initial?: DataFormValues;
  readonly disabled?: boolean;
  readonly submitLabel?: string;
}
type SubmitEmit = (event: 'submit', value: DataFormValues) => void;
const leaves = (nodes: readonly DataFormNode[]): DataFormNode[] => nodes.flatMap(node => node.children ? leaves(node.children) : [node]);
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const scalarText = (value: unknown): string => typeof value === 'string' || typeof value === 'number' ? String(value) : '';

/** Native controls report through their event target; this reads it without assuming its window's globals. */
const eventValue = ({ target }: Event): unknown => target !== null && 'value' in target ? target.value : undefined;
const eventChecked = ({ target }: Event): boolean => target !== null && 'checked' in target && target.checked === true;
/** Initial control state: the supplied value first, then the definition default; choices keep offered ids only. */
function seed(draft: DataFormDraft, nodes: readonly DataFormNode[], initial: DataFormValues | undefined): void {
  for (const { field, path } of leaves(nodes)) {
    const value = valueAt(initial, path) ?? field.default;
    const offered = (field.choices ?? []).map(choice => choice.id);
    if (field.kind === 'boolean') draft.flags.set(path, value === true);
    else if (field.kind === 'multi') draft.picks.set(path, offered.filter(id => strings(value).includes(id)));
    else if (field.kind === 'select') draft.texts.set(path, offered.find(id => id === value) ?? '');
    else draft.texts.set(path, field.kind === 'list' ? strings(value).join('\n') : scalarText(value));
  }
  draft.seeded = true; draft.attempted = false;
}
/** Converts raw control text into the typed candidate the domain validates; empty optional answers are absent. */
function draftValue(field: DataFormField, path: string, draft: DataFormDraft): DataFormValue | undefined {
  if (field.kind === 'boolean') return draft.flags.get(path) === true;
  if (field.kind === 'multi') return draft.picks.get(path) ?? [];
  const raw = draft.texts.get(path) ?? '';
  if (field.kind === 'list') return raw.split('\n').map(line => line.trim()).filter(Boolean);
  if (field.kind !== 'number' && field.kind !== 'select') return raw;
  if (!raw.trim()) return undefined;
  return field.kind === 'number' ? Number(raw) : raw;
}
function candidate(nodes: readonly DataFormNode[], draft: DataFormDraft): DataFormValues {
  const value: DataFormValues = {};
  for (const { field, path } of leaves(nodes)) {
    const entry = draftValue(field, path, draft);
    if (entry !== undefined) assignAt(value, path, entry);
  }
  return value;
}

/** Draft, visibility, validation messages and submit for one rendered definition. Nothing is persisted here. */
export function useDataForm(props: DataFormProps, emit: SubmitEmit) {
  const { t } = useI18n();
  const uid = useId();
  const form = ref<HTMLFormElement>();
  const all = allDataFormNodes(props.definition);
  const drafts = useDataFormDrafts();
  const draft = drafts.draft(props.definition);
  if (!draft.seeded) seed(draft, all, props.initial);
  const value = computed(() => candidate(all, draft));
  const nodes = computed(() => visibleDataFormNodes(props.definition, value.value));
  const outcome = computed(() => readDataFormValue(props.definition, value.value));
  const issues = computed(() => draft.attempted && !outcome.value.ok ? outcome.value.issues : []);
  function issue(path: string): string | undefined {
    const found = issues.value.find(item => item.path === path);
    return found && (found.message ?? t(`form.issue.${found.code}`, { ...found.params }));
  }
  async function submit() {
    if (props.disabled === true) return;
    draft.attempted = true;
    const result = outcome.value;
    if (result.ok) { emit('submit', result.value); return; }
    await nextTick();
    form.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }
  function pick(node: DataFormNode, id: string, selected: boolean) {
    const current = new Set(draft.picks.get(node.path));
    if (selected) current.add(id); else current.delete(id);
    draft.picks.set(node.path, (node.field.choices ?? []).map(choice => choice.id).filter(choice => current.has(choice)));
  }
  const describe = (path: string, part: 'help' | 'error' | 'hint') => `${uid}-${path}-${part}`;
  const setText = (path: string, input: unknown) => { draft.texts.set(path, scalarText(input)); };
  return {
    t, uid, form, nodes, issues, issue, submit, describe, setText,
    reset: () => seed(draft, all, props.initial),
    submitText: computed(() => props.submitLabel ?? t('form.submit')),
    control: (path: string) => `${uid}-${path}`,
    invalid: (path: string) => issue(path) === undefined ? undefined : 'true',
    describedBy: (node: DataFormNode) => [node.field.help && describe(node.path, 'help'), node.field.kind === 'list' && describe(node.path, 'hint'), issue(node.path) && describe(node.path, 'error')].filter(Boolean).join(' ') || undefined,
    required: (field: DataFormField) => field.required === true || field.kind === 'title',
    text: (path: string) => draft.texts.get(path) ?? '',
    flag: (path: string) => draft.flags.get(path) === true,
    picked: (path: string, id: string) => draft.picks.get(path)?.includes(id) === true,
    onText: (path: string, event: Event) => setText(path, eventValue(event)),
    onFlag: (path: string, event: Event) => { draft.flags.set(path, eventChecked(event)); },
    onPick: (node: DataFormNode, id: string, event: Event) => pick(node, id, eventChecked(event)),
  };
}
export type DataFormModel = ReturnType<typeof useDataForm>;
