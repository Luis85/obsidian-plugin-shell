# Obsidian implementation architecture

The Vue/Vite app in this package is an interaction prototype. The production Obsidian plugin should use these boundaries.

## Source of truth

- Agent, role, skill, tool, source, relation, guardrail and evaluation definitions: Markdown + frontmatter in configured vault folders.
- Plugin data (`Plugin.loadData/saveData`): UI preferences, view state, last selected agent, feature flags; never the only copy of domain entities.
- Generated provider/runtime files: derived outputs in `.agents/generated` or explicit runtime target paths.

## Repositories

```ts
interface AgentRepository {
  list(): Promise<AgentSummary[]>
  get(id: string): Promise<AgentDefinition | undefined>
  save(agent: AgentDefinition): Promise<void>
  snapshot(id: string, note: string): Promise<AgentVersion>
}
```

Implement with `Vault`, `Vault.process()`, `FileManager.processFrontMatter()` and `normalizePath()` rather than Node `fs` so the core plugin remains mobile-compatible.

## Views

- Registry: properties/Bases-compatible lightweight list/card view.
- Klaus Editor: Vue view; lazy-import the Three.js renderer only when the spatial panel is opened.
- Academy: no 3D dependency.
- Safety / Eval / Runtime adapters: no 3D dependency.
- Mobile: station/list navigator is primary; spatial world may be disabled or simplified based on `Platform` and performance.

## Performance

- Register views/commands during `onload`, but defer expensive initialization to `workspace.onLayoutReady()`.
- Do not scan all vault files per render; use metadata/property indexes and scoped folders.
- Cache parsed entity summaries and invalidate by vault events.
- Defer the Klaus 3D view and dispose WebGL resources when closed.

## Adapter boundary

```ts
interface RuntimeAdapter {
  id: string
  validate(model: AgentDefinitionModel): ValidationIssue[]
  generate(model: AgentDefinitionModel, agentId: string): GeneratedArtifact[]
}
```

Initial adapters: canonical Obsidian Markdown/frontmatter, AGENTS.md, GitHub custom agent, Agent Skill, MCP configuration, provider-neutral JSON.
