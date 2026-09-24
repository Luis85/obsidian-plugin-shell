import { onScopeDispose, ref, shallowRef } from 'vue';
/** A per-view projection, never the canonical repository. Latest read wins;
 * duplicate writes are refused rather than silently reissued. */
export function operation<Input, Output>(run: (input: Input, signal: AbortSignal) => Promise<Output>, direction: string) {
  const data = shallowRef<Output | null>(null); const pending = ref(false); const error = ref<string | null>(null);
  let revision = 0; let disposed = false; let active: AbortController | undefined;
  function cancel() { revision++; active?.abort(); active = undefined; pending.value = false; }
  onScopeDispose(() => { disposed = true; cancel(); });
  async function execute(input: Input) {
    if (disposed) return {ok:false as const,code:'disposed'};
    if (pending.value && direction !== 'read') return {ok:false as const,code:'busy'};
    active?.abort(); const controller = new AbortController(); active = controller;
    const current = ++revision; pending.value = true; error.value = null;
    try {
      const value = await run(input,controller.signal);
      if (disposed || current !== revision) return {ok:false as const,code:'superseded'};
      data.value = value; return {ok:true as const,value};
    } catch (cause) {
      if (disposed || current !== revision) return {ok:false as const,code:'superseded'};
      const code = cause instanceof Error && cause.message.startsWith('NOT_IMPLEMENTED:') ? 'not-implemented' : 'operation-failed';
      error.value = code; return {ok:false as const,code};
    } finally { if (current === revision) { pending.value = false; active = undefined; } }
  }
  return {data,pending,error,execute,cancel};
}
