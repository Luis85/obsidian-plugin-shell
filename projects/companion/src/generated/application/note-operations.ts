interface NoteLease { readonly id: string; readonly revision: number; readonly values: object }
type NoteResult<T> = {readonly ok:true;readonly value:T} | {readonly ok:false;readonly error:{readonly code:string}};
interface CanonicalNotes<I,S extends NoteLease> {
  list(): Promise<NoteResult<readonly S[]>>;
  create(values:I,requestId:string,permit?:{active():boolean}): Promise<NoteResult<S>>;
  update(snapshot:S,values:I,permit:{active():boolean}): Promise<NoteResult<S>>;
  delete(snapshot:S,permit:{active():boolean}): Promise<NoteResult<void>>;
}
/** Runtime-only leases identify the note and its revision: unrelated records often share a revision. */
export function noteOperations<I, S extends NoteLease>(repository: CanonicalNotes<I, S>, entity: string, parse: (input: unknown) => I) {
  const snapshots = new Map<string, S>();
  const leaseKey = (id: string, revision: number) => JSON.stringify([id, revision]);
  function present(snapshot: S) {
    if (snapshots.size >= 1000) snapshots.clear();
    snapshots.set(leaseKey(snapshot.id, snapshot.revision), snapshot);
    return {record: { ...snapshot.values, id:snapshot.id, type:entity }, revision:snapshot.revision};
  }
  function input(value: unknown): Record<string, unknown> {
    // Reflect.ownKeys also covers non-enumerable and symbol members, so no accessor executes.
    if (!value || typeof value !== 'object' || ![Object.prototype,null].includes(Object.getPrototypeOf(value)) || Reflect.ownKeys(value).some(key=>typeof key !== 'string' || ['__proto__','constructor','prototype'].includes(key) || !('value' in Object.getOwnPropertyDescriptor(value,key)!))) throw new Error('NOTE_INPUT_INVALID');
    return value as Record<string, unknown>;
  }
  function lease(record: Record<string, unknown>): S {
    const snapshot = typeof record.id === 'string' && typeof record.revision === 'number'
      ? snapshots.get(leaseKey(record.id, record.revision)) : undefined;
    if (!snapshot || snapshot.id !== record.id) throw new Error('NOTE_REVISION_STALE'); return snapshot;
  }
  return {
    async list(_input?: unknown, signal?: AbortSignal) {
      if (signal?.aborted) throw new Error('OPERATION_ABORTED'); const result=await repository.list();
      if(!result.ok) throw new Error('NOTE_READ_FAILED: '+result.error.code); return result.value.map(present);
    },
    async create(value: unknown, signal?: AbortSignal) {
      const record = input(value); const values = parse(input(record.values));
      // Same request-id contract as the canonical DocumentService.
      if(typeof record.requestId !== 'string' || !/^[a-zA-Z0-9:-]{1,100}$/.test(record.requestId)) throw new Error('NOTE_REQUEST_ID_REQUIRED');
      if(signal?.aborted) throw new Error('OPERATION_ABORTED');
      const result=await repository.create(values,record.requestId,{active:()=>!signal?.aborted}); if(!result.ok) throw new Error('NOTE_CREATE_FAILED: '+result.error.code); return present(result.value);
    },
    async update(value: unknown, signal?: AbortSignal) {
      const record=input(value); const snapshot=lease(record); const values=parse(input(record.values));
      if(signal?.aborted) throw new Error('OPERATION_ABORTED');
      const result=await repository.update(snapshot,values,{active:()=>!signal?.aborted});
      if(!result.ok) throw new Error('NOTE_UPDATE_FAILED: '+result.error.code); snapshots.delete(leaseKey(snapshot.id, snapshot.revision)); return present(result.value);
    },
    async delete(value: unknown, signal?: AbortSignal) {
      const snapshot=lease(input(value)); if(signal?.aborted) throw new Error('OPERATION_ABORTED');
      const result=await repository.delete(snapshot,{active:()=>!signal?.aborted});
      if(!result.ok) throw new Error('NOTE_DELETE_FAILED: '+result.error.code); snapshots.delete(leaseKey(snapshot.id, snapshot.revision));
    },
  };
}
