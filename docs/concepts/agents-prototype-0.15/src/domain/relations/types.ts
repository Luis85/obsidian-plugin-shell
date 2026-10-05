export type RelationType = 'delegates-to' | 'consults' | 'supervises' | 'inherits-from' | 'shares-memory-with' | 'uses-output-of' | 'reviews'

export interface AgentRelation {
  id: string
  fromAgentId: string
  toAgentId: string
  type: RelationType
  description: string
}
