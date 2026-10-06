import type { Agent, AgentVersion, Role, SkillDefinition, ToolDefinition, DataSource, InstructionLayer, Guardrail, McpServerDefinition, RuntimeAdapter } from '../agents/types'
import type { AgentRelation } from '../relations/types'
import type { CharacterStylePreset, CharacterPackDefinition } from '../characters/types'

export interface PluginState {
  schemaVersion: string
  project: {
    name: string
    repoPath: string
    vaultName: string
    description: string
  }
  settings: {
    agentsPath: string
    rolesPath: string
    skillsPath: string
    toolsPath: string
    dataSourcesPath: string
    relationsPath: string
    guardrailsPath: string
    generatedPath: string
    autoSave: boolean
    sourceOfTruth: 'markdown-frontmatter'
  }
  agents: Agent[]
  roles: Role[]
  skills: SkillDefinition[]
  tools: ToolDefinition[]
  dataSources: DataSource[]
  instructionLayers: InstructionLayer[]
  guardrails: Guardrail[]
  mcpServers: McpServerDefinition[]
  runtimeAdapters: RuntimeAdapter[]
  characterStyles: CharacterStylePreset[]
  characterPacks: CharacterPackDefinition[]
  relations: AgentRelation[]
  versions: AgentVersion[]
}
