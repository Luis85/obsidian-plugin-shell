import type { Agent } from './types'
import { cloneData } from '../shared/cloneData'

export const nextPatch = (version: string) => {
  const parts = version.split('.').map(v => Number.parseInt(v, 10) || 0)
  return `${parts[0] ?? 0}.${parts[1] ?? 0}.${(parts[2] ?? 0) + 1}`
}

export const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export const cloneAgent = (agent: Agent): Agent => cloneData(agent)

export const createVariant = (agent: Agent, label: string, id: string): Agent => {
  const copy = cloneAgent(agent)
  copy.id = id
  copy.name = `${agent.name} · ${label}`
  copy.slug = `${agent.slug}-${slugify(label)}`
  copy.kind = 'specialist'
  copy.variantOf = agent.id
  copy.variantLabel = label
  copy.inheritance = { baseAgentId: agent.id, baseVersion: agent.version, overridePaths: ['name','slug','kind','variantLabel','status'] }
  copy.version = '0.1.0'
  copy.status = 'draft'
  return copy
}
