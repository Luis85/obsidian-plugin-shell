import { inject, type InjectionKey } from 'vue';
import type { FlowRuntime } from './contracts.ts';
export const flowKey: InjectionKey<FlowRuntime> = Symbol('journey-flow');
export function useFlowRuntime(): FlowRuntime {
  const flow = inject(flowKey); if (!flow) throw Error('JOURNEY_FLOW_MISSING'); return flow;
}
