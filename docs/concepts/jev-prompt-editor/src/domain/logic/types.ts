namespace Jev {
  export type FieldType = 'string' | 'number' | 'boolean' | 'object' | 'array';
  export type LogicStatus = 'draft' | 'ready' | 'archived';
  export interface ContractField { name: string; type: FieldType; required: boolean; description: string }
  /** Data-only expressions; never JavaScript, interpolation, or an executable script. */
  export interface ValueBinding { mode: 'path' | 'literal' | 'add'; value: string; amount: number }
  export interface NamedBinding { name: string; binding: ValueBinding }
  export interface LogicEvent {
    id: string; name: string; description: string;
    when: 'completed' | 'true' | 'false' | 'review' | 'error';
    fields: ContractField[]; payload: NamedBinding[];
  }
  export interface LogicEntity { id: string; name: string; description: string; status: LogicStatus; events: LogicEvent[] }
  export type ConditionOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'exists' | 'missing';
  export interface Condition { id: string; left: ValueBinding; operator: ConditionOperator; right: ValueBinding }
  export interface RuleDecision { type: 'continue' | 'process' | 'end' | 'review'; code: string; processId: string }
  export interface RuleBranch { id: string; name: string; match: 'all' | 'any'; conditions: Condition[]; decision: RuleDecision }
  export interface BusinessRule extends LogicEntity {
    mode: 'if' | 'while'; inputs: ContractField[]; branches: RuleBranch[];
    fallback: RuleDecision; maxIterations: number;
  }
  export interface ProcessDefinition extends LogicEntity {
    mode: 'transform' | 'fixture' | 'external'; inputs: ContractField[]; outputs: ContractField[]; mappings: NamedBinding[];
  }
  export interface FlowNode {
    id: string; kind: 'start' | 'prompt' | 'rule' | 'process' | 'end'; name: string; refId: string;
    x: number; y: number; inputs: NamedBinding[]; events: LogicEvent[];
  }
  export interface FlowEdge { id: string; source: string; port: string; target: string; kind: 'control' | 'event' }
  export interface FlowDefinition extends LogicEntity {
    nodes: FlowNode[]; edges: FlowEdge[]; sampleInput: string; maxSteps: number; maxEvents: number;
  }
  export interface LogicSnapshot { rules: BusinessRule[]; processes: ProcessDefinition[]; flows: FlowDefinition[] }
  export interface LogicRevision { id: string; name: string; createdAt: string; snapshot: LogicSnapshot }
  export interface LogicLibrary extends LogicSnapshot { kind: 'jev-logic'; schemaVersion: 1; revisions: LogicRevision[] }
  export interface LogicIssue { path: string; message: string; severity: 'error' | 'warning'; nodeId?: string }
  export interface EventEnvelope { id: string; name: string; source: string; sequence: number; correlationId: string; causationId: string; payload: Record<string, unknown> }
  export interface TraceEntry {
    sequence: number; nodeId: string; name: string; kind: FlowNode['kind']; port: string;
    input: Record<string, unknown>; output: Record<string, unknown>; events: EventEnvelope[];
    status: 'completed' | 'review' | 'error'; detail: string; conditions: {branch: string; matches: boolean[]; matched: boolean}[];
    request?: RequestBody;
  }
  export interface PendingStep { nodeId: string; input: Record<string, unknown>; event?: EventEnvelope }
  export interface Simulation {
    retainedCharacters: number; status: 'paused' | 'completed' | 'review' | 'error' | 'cancelled'; reason: string; runId: string;
    queue: PendingStep[]; trace: TraceEntry[]; events: EventEnvelope[];
    outputs: Record<string, {output: Record<string, unknown>}>; visits: Record<string, number>;
    iterations: Record<string, number>; input: Record<string, unknown>; scenario: string;
  }
  export interface RuleEvaluation { decision: RuleDecision; port: string; conditions: TraceEntry['conditions']; iteration: number }
  export const literal = (value: unknown): ValueBinding => ({mode:'literal',value:JSON.stringify(value),amount:1});
  export const reference = (value: string): ValueBinding => ({mode:'path',value,amount:1});
  export const binding = (name: string, value: ValueBinding): NamedBinding => ({name,binding:value});
  export const field = (name: string, type: FieldType, required=true): ContractField => ({name,type,required,description:''});
  export const decision = (type: RuleDecision['type']='continue', code='continue', processId=''): RuleDecision => ({type,code,processId});
}
