import * as v from './shape'
import { id, ids, color, appearanceFields, appearanceShape, styleShape, packShape } from './characterShapes'
const strings = v.array(v.text)
const semver = v.matching(/^\d+\.\d+\.\d+$/, 'Expected a numeric semantic version (major.minor.patch).')
const approval = v.oneOf('never', 'on-write', 'on-risk', 'always')
const named = { id, name: v.text }
const capability = { ...named, description: v.text, category: v.text }
const trait = { ...named, points: v.number(), notes: v.optional(v.text) }
const gurps = v.object({
  ...Object.fromEntries(['st', 'dx', 'iq', 'ht', 'hp', 'will', 'per', 'fp', 'pointTotal', 'unspentPoints'].map(key => [key, v.number()])),
  advantages: v.array(v.object(trait)), disadvantages: v.array(v.object(trait)),
  quirks: v.array(v.object({ ...named, notes: v.optional(v.text) })),
  skills: v.array(v.object({ ...trait, level: v.number() }))
})
const instructionLayer = v.object({ ...named, scope: v.oneOf('repository', 'path', 'agent', 'task'), content: v.text, sourcePath: v.optional(v.text), applyTo: v.optional(v.text), priority: v.number() })
const pathPolicy = v.object({ id, entity: v.text, path: v.text, permissions: v.array(v.oneOf('read', 'write', 'create', 'delete', 'search')), purpose: v.text })
const agent = (legacy: boolean) => v.object({
  ...named, slug: v.text, kind: v.oneOf('general', 'specialist'), status: v.oneOf('draft', 'active', 'deprecated'),
  description: v.text, color, model: id, appearance: legacy ? v.optional(v.partial(appearanceFields)) : appearanceShape,
  roleId: id, version: semver, variantOf: v.optional(id), variantLabel: v.optional(v.text),
  inheritance: v.optional(v.object({ baseAgentId: id, baseVersion: semver, overridePaths: strings })),
  systemPrompt: v.text, goals: strings, constraints: strings,
  invocation: v.object({ userInvocable: v.boolean, allowAutoDelegation: v.boolean, handoffDescription: v.text }),
  autonomy: v.object({ maxSteps: v.number(1, 100_000, true), approvalPolicy: approval, stopConditions: strings }),
  instructionLayerIds: ids, guardrailIds: ids, skillIds: ids, toolIds: ids, dataSourceIds: ids,
  shortTermMemory: v.object({ strategy: v.oneOf('context-window'), tokenBudget: v.number(0, 100_000_000, true), workingNotes: v.boolean, retrieval: v.text, compaction: v.text }),
  longTermMemory: v.object({ strategy: v.oneOf('obsidian-vault+git'), summaryPath: v.text, retrievalNotes: v.text, indexing: v.oneOf('properties+links+search', 'search', 'external-index') }),
  pathPolicies: v.array(pathPolicy), gurps,
  evals: v.array(v.object({ ...named, status: v.oneOf('not-run', 'passing', 'failing'), task: v.text, criteria: strings, lastScore: v.optional(v.number()), lastRunAt: v.optional(v.text) }))
})
export const stateShape = (legacy = false) => v.object({
  schemaVersion: semver,
  project: v.object({ name: v.text, repoPath: v.text, vaultName: v.text, description: v.text }),
  settings: v.object({
    ...Object.fromEntries(['agentsPath', 'rolesPath', 'skillsPath', 'toolsPath', 'dataSourcesPath', 'relationsPath', 'guardrailsPath', 'generatedPath'].map(key => [key, v.text])),
    autoSave: v.boolean, sourceOfTruth: v.oneOf('markdown-frontmatter')
  }),
  agents: v.array(agent(legacy)),
  roles: v.array(v.object({ ...named, purpose: v.text, responsibilities: strings, defaultSkillIds: ids, defaultToolIds: ids })),
  skills: v.array(v.object({ ...capability, entrypoint: v.text, loading: v.oneOf('on-demand', 'preload'), allowedToolIds: ids, resourcePaths: strings })),
  tools: v.array(v.object({ ...capability, namespace: v.text, kind: v.oneOf('data', 'action', 'orchestration', 'mcp'), risk: v.oneOf('low', 'medium', 'high'), approval, sideEffects: v.boolean, destructive: v.boolean, inputSchema: v.jsonObject, outputSchema: v.jsonObject, mcpServerId: v.optional(id) })),
  dataSources: v.array(v.object({ ...capability, type: v.oneOf('vault', 'git', 'api', 'database', 'filesystem', 'mcp-resource'), connection: v.text, trust: v.oneOf('trusted', 'mixed', 'untrusted'), freshness: v.text, retrieval: v.text })),
  instructionLayers: v.array(instructionLayer),
  guardrails: v.array(v.object({ ...named, kind: v.oneOf('input', 'output', 'tool', 'path'), description: v.text, enforcement: v.oneOf('block', 'review', 'redact', 'warn'), toolIds: v.optional(ids) })),
  mcpServers: v.array(v.object({ ...named, protocolVersion: v.text, transport: v.oneOf('stdio', 'streamable-http', 'hosted'), endpoint: v.text, auth: v.oneOf('none', 'oauth', 'managed', 'environment'), capabilityTypes: v.array(v.oneOf('tools', 'resources', 'prompts')), trust: v.oneOf('trusted', 'mixed', 'untrusted') })),
  runtimeAdapters: v.array(v.object({ ...named, kind: v.oneOf('obsidian-markdown', 'agents-md', 'github-custom-agent', 'agent-skill', 'mcp-config', 'generic-json'), targetPath: v.text, description: v.text, generated: v.boolean })),
  characterStyles: legacy ? v.optional(v.array(styleShape)) : v.array(styleShape),
  characterPacks: legacy ? v.optional(v.array(packShape)) : v.array(packShape),
  relations: v.array(v.object({ id, fromAgentId: id, toAgentId: id, type: v.oneOf('delegates-to', 'consults', 'supervises', 'inherits-from', 'shares-memory-with', 'uses-output-of', 'reviews'), description: v.text })),
  versions: v.array(v.object({ id, agentId: id, version: semver, createdAt: v.text, note: v.text, snapshot: agent(legacy) }))
})
