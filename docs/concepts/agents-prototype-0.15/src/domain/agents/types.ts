import type { CharacterAppearance } from '../characters/types'
import type { ApprovalPolicy, Permission, RiskLevel } from '../shared/types'
export type AgentKind = 'general' | 'specialist'
export type AgentStatus = 'draft' | 'active' | 'deprecated'

export interface CharacterSkill {
  id: string
  name: string
  level: number
  points: number
  notes?: string
}

export interface GurpsSheet {
  st: number
  dx: number
  iq: number
  ht: number
  hp: number
  will: number
  per: number
  fp: number
  pointTotal: number
  unspentPoints: number
  advantages: { id: string; name: string; points: number; notes?: string }[]
  disadvantages: { id: string; name: string; points: number; notes?: string }[]
  quirks: { id: string; name: string; notes?: string }[]
  skills: CharacterSkill[]
}

export interface PathPolicy {
  id: string
  entity: string
  path: string
  permissions: Permission[]
  purpose: string
}

export interface InstructionLayer {
  id: string
  name: string
  scope: 'repository' | 'path' | 'agent' | 'task'
  content: string
  sourcePath?: string
  applyTo?: string
  priority: number
}

export interface AgentInvocation {
  userInvocable: boolean
  allowAutoDelegation: boolean
  handoffDescription: string
}

export interface AgentAutonomy {
  maxSteps: number
  approvalPolicy: ApprovalPolicy
  stopConditions: string[]
}

export interface AgentEval {
  id: string
  name: string
  status: 'not-run' | 'passing' | 'failing'
  task: string
  criteria: string[]
  lastScore?: number
  lastRunAt?: string
}

export interface Agent {
  id: string
  slug: string
  name: string
  kind: AgentKind
  status: AgentStatus
  description: string
  color: string
  model: string
  appearance: CharacterAppearance
  roleId: string
  version: string
  variantOf?: string
  variantLabel?: string
  inheritance?: { baseAgentId: string; baseVersion: string; overridePaths: string[] }
  systemPrompt: string
  goals: string[]
  constraints: string[]
  invocation: AgentInvocation
  autonomy: AgentAutonomy
  instructionLayerIds: string[]
  guardrailIds: string[]
  shortTermMemory: {
    strategy: 'context-window'
    tokenBudget: number
    workingNotes: boolean
    retrieval: string
    compaction: string
  }
  longTermMemory: {
    strategy: 'obsidian-vault+git'
    summaryPath: string
    retrievalNotes: string
    indexing: 'properties+links+search' | 'search' | 'external-index'
  }
  skillIds: string[]
  toolIds: string[]
  dataSourceIds: string[]
  pathPolicies: PathPolicy[]
  gurps: GurpsSheet
  evals: AgentEval[]
}

export interface Role {
  id: string
  name: string
  purpose: string
  responsibilities: string[]
  defaultSkillIds: string[]
  defaultToolIds: string[]
}

export interface Capability {
  id: string
  name: string
  description: string
  category: string
}

export interface SkillDefinition extends Capability {
  entrypoint: string
  loading: 'on-demand' | 'preload'
  allowedToolIds: string[]
  resourcePaths: string[]
}

export interface ToolDefinition extends Capability {
  namespace: string
  kind: 'data' | 'action' | 'orchestration' | 'mcp'
  risk: RiskLevel
  approval: ApprovalPolicy
  sideEffects: boolean
  destructive: boolean
  inputSchema: Record<string, unknown>
  outputSchema: Record<string, unknown>
  mcpServerId?: string
}

export interface DataSource extends Capability {
  type: 'vault' | 'git' | 'api' | 'database' | 'filesystem' | 'mcp-resource'
  connection: string
  trust: 'trusted' | 'mixed' | 'untrusted'
  freshness: string
  retrieval: string
}

export interface Guardrail {
  id: string
  name: string
  kind: 'input' | 'output' | 'tool' | 'path'
  description: string
  enforcement: 'block' | 'review' | 'redact' | 'warn'
  toolIds?: string[]
}

export interface McpServerDefinition {
  id: string
  name: string
  protocolVersion: string
  transport: 'stdio' | 'streamable-http' | 'hosted'
  endpoint: string
  auth: 'none' | 'oauth' | 'managed' | 'environment'
  capabilityTypes: ('tools' | 'resources' | 'prompts')[]
  trust: 'trusted' | 'mixed' | 'untrusted'
}

export interface RuntimeAdapter {
  id: string
  name: string
  kind: 'obsidian-markdown' | 'agents-md' | 'github-custom-agent' | 'agent-skill' | 'mcp-config' | 'generic-json'
  targetPath: string
  description: string
  generated: boolean
}

export interface AgentVersion {
  id: string
  agentId: string
  version: string
  createdAt: string
  note: string
  snapshot: Agent
}
