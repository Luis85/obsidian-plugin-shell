import { reactive } from 'vue';
import { defineStore } from 'pinia';
import type { DataFormDefinition } from '../../domain/forms/model';

/** Raw control state by absolute field path; it becomes a typed candidate value only when read. */
export interface DataFormDraft {
  readonly texts: Map<string, string>;
  readonly flags: Map<string, boolean>;
  readonly picks: Map<string, readonly string[]>;
  attempted: boolean;
  seeded: boolean;
}
/** Per-view drafts keyed by form id and version, so navigating away and back keeps unsent input. */
export const useDataFormDrafts = defineStore('data-form-drafts', () => {
  const drafts = new Map<string, DataFormDraft>();
  function draft(definition: DataFormDefinition): DataFormDraft {
    const key = `${definition.id}@${definition.version}`;
    const current = drafts.get(key) ?? reactive({ texts: new Map(), flags: new Map(), picks: new Map(), attempted: false, seeded: false });
    drafts.set(key, current);
    return current;
  }
  return { draft };
});
