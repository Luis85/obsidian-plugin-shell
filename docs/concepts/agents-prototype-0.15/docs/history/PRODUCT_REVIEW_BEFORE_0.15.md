# Agents / Klaus Editor — Product review and improvement pass

Research snapshot: 2026-10-03

## Executive assessment

The strongest product is not “Minecraft for agent JSON.” It is a vault-native **agent environment workbench** with three complementary jobs:

1. **Learn** — understand what an agent, its context, memory, tools, skills, permissions and relationships actually need.
2. **Configure** — author a neutral, validated Agent Definition Model through conventional editors or the optional spatial Klaus world.
3. **Verify & project** — test configuration assumptions with evals/traces and generate runtime-specific artifacts through adapters.

The voxel world remains a differentiator, but it should be a spatial teaching/navigation layer over an authoritative declarative model. It must never become the only efficient way to operate the product.

## Research-grounded findings

### 1. Agent architecture

Current agent platforms treat an agent as more than a persona: instructions, tools, runtime/model configuration, orchestration/handoffs, guardrails, state and observability are distinct concerns. The revised model therefore adds explicit invocation/handoff contracts, autonomy/approval policy, guardrails, instruction layers, eval scenarios and runtime adapters.

Source: https://developers.openai.com/api/docs/guides/agents/sdk

### 2. Guardrails and human review

Risk controls belong at concrete execution boundaries. Input/output/tool guardrails and human approvals are different mechanisms. High-risk side effects should be represented as tool policy, not as a sentence buried in the prompt.

Source: https://developers.openai.com/api/docs/guides/agents/guardrails-approvals

### 3. Observability and evaluation

Configuration completeness cannot prove quality. Traces expose tool calls, handoffs and approvals; eval scenarios measure outcomes across representative tasks. The UI now distinguishes **configuration coverage** from **behavioral verification**.

Sources:
- https://developers.openai.com/api/docs/guides/agents/integrations-observability
- https://developers.openai.com/api/docs/guides/agents/evals

### 4. Context and memory

The vault/repository are durable external storage, not automatic model memory. Retrieval, metadata, links and indexes find evidence; context assembly recalls selected evidence into finite working memory. The product should teach this distinction explicitly and continuously.

Sources:
- https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- https://docs.obsidian.md/Plugins/Vault

### 5. Tool design

Tools should be distinct, namespaced, bounded and token-efficient. Input/output schemas, side effects, risk and approval metadata belong in the model. This is especially important when an environment exposes many MCP-backed capabilities.

Source: https://www.anthropic.com/engineering/writing-tools-for-agents

### 6. MCP

MCP must be modeled as an integration boundary rather than as the core agent model. The 2026-07-28 protocol revision introduced a stateless core, authorization changes, cacheable listings and an extensions framework. Agents should reference MCP-backed capabilities while server protocol/transport/auth metadata remains independently versioned.

Source: https://blog.modelcontextprotocol.io/posts/2026-07-28/

### 7. Declarative model and validation

JSON Schema Draft 2020-12 remains the current published JSON Schema version. The Agent Definition Model now has an explicit schema version, a checked schema artifact and referential validation. Schema migrations should be first-class before production use.

Sources:
- https://json-schema.org/specification
- https://json-schema.org/draft/2020-12

### 8. Instruction layering

Modern coding-agent ecosystems distinguish repository-wide instructions, path-specific instructions, portable `AGENTS.md`, custom agents and task-specific skills. Klaus Editor should teach and model those scopes rather than flattening all guidance into one system prompt.

Sources:
- https://docs.github.com/en/copilot/reference/customization-cheat-sheet
- https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/add-custom-instructions/add-repository-instructions

### 9. Skills

Skills are increasingly represented as reusable folders containing `SKILL.md` plus optional scripts/resources. The revised skill entity therefore has an entrypoint, loading policy, allowed tool IDs and resource paths.

Source: https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/add-skills

### 10. Obsidian-native persistence

The production plugin should use Markdown/frontmatter as the canonical entity store and Obsidian APIs for mutation. Obsidian recommends Vault APIs over direct adapters, `Vault.process()` for safe file mutation, `FileManager.processFrontMatter()` for properties, and normalized user paths. Plugin data should hold plugin preferences, not duplicate authoritative business entities.

Sources:
- https://docs.obsidian.md/oo/plugin
- https://docs.obsidian.md/Plugins/Vault

### 11. Obsidian Bases

The Agent Registry maps naturally to Obsidian note properties. A custom Bases view can become an optional native registry surface rather than maintaining a second database. Large datasets should be filtered and rendered efficiently.

Source: https://docs.obsidian.md/plugins/guides/bases-view

### 12. Performance and mobile

Three.js should be deferred/lazy-loaded only when Klaus World is opened. Obsidian loads plugins before interaction and warns against expensive startup work. Node/Electron APIs are unavailable on mobile, so the product needs a fully usable conventional/list navigator and platform-aware capabilities.

Sources:
- https://docs.obsidian.md/plugins/guides/load-time
- https://docs.obsidian.md/Plugins/Getting%20started/Mobile%20development


## Market and positioning perspective

The surrounding market is converging on **specialized agent profiles, scoped tools, sub-agent orchestration, skills, observability and portable file-based configuration**. GitHub custom agents already expose descriptions, user/automatic invocation, scoped tools and MCP servers, while its SDK runs specialists in isolated contexts. Visual workflow builders also show that canvas-first UX is useful for explanation/debugging but can be product-lifecycle dependent: OpenAI's Agent Builder is scheduled to shut down on November 30, 2026. That strengthens the decision to make Klaus World a replaceable presentation layer over a durable model rather than the model itself.

A 2026 LangChain survey of 1,300+ professionals reported observability adoption substantially ahead of eval adoption and cited quality as a major production barrier. For this product, the opportunity is therefore not another workflow canvas; it is an **explainable configuration + governance + learning layer for coding-agent environments living in the repository/vault itself**.

Sources:
- https://docs.github.com/en/copilot/reference/custom-agents-configuration
- https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/custom-agents
- https://developers.openai.com/api/docs/guides/agent-builder
- https://www.langchain.com/state-of-agent-engineering

## Product-perspective review

| Perspective | Main issue found | Improvement applied |
| --- | --- | --- |
| Product strategy | Risk of becoming a novelty 3D JSON editor | Reframed around Learn → Configure → Verify/Project; spatial world is optional |
| Core domain | Agent definition omitted runtime/safety concerns | Added invocation, autonomy, guardrails, instruction layers, MCP, evals and adapters |
| Information architecture | Too many concepts entered through one editor | Added overview, safety, eval, instructions and runtime workspaces |
| Teaching | Binary “ready” status implied quality | Renamed to configuration coverage; maturity levels and behavioral evidence are separate |
| Memory mental model | “Vault = memory” could be misunderstood | Explicit Store → Retrieve → Assemble Context model and provenance requirement |
| Obsidian integration | Prototype local state could become accidental architecture | Canonical source declared as Markdown + frontmatter; Bases-compatible registry direction |
| Multi-agent design | Relations alone insufficient for routing | Added handoff descriptions and invocation policy |
| Variants/versioning | Deep clones can drift from parents | Added explicit inheritance/base-version/override metadata and effective-config direction |
| Tools | Tools lacked contracts and governance | Added namespace, kind, input/output schema, side effects, risk and approval |
| MCP | Treated only as a datasource string | Added MCP server entities with protocol/transport/auth/capabilities/trust |
| Skills | Flat labels only | Added package entrypoint, on-demand loading, resource paths and allowed tools |
| Safety | Safety mostly expressed as prompt constraints | Added typed guardrails, approvals and path enforcement concepts |
| Observability | No runtime evidence model | Added Eval Lab and trace anatomy |
| Data quality | Import checks were shallow | Added structural/referential validation and JSON Schema 2020-12 artifact |
| Runtime portability | Scaffolding was generic | Added adapter hub for Obsidian, AGENTS.md, GitHub custom agent, skills, MCP and neutral JSON |
| UX | 3D surface risked blocking expert workflows | Added conventional workspaces and an accessible station list |
| Accessibility | Canvas required pointer use; fixed-width shell | Added keyboard station controls, focus treatment, responsive layout and reduced-motion handling |
| Performance | Continuous/always-loaded 3D risk | Source prototype pauses rendering while hidden; production architecture calls for lazy-load/deferred view |
| Mobile | Fixed desktop layout | Responsive fallbacks; spatial view is enhancement rather than requirement |
| GURPS metaphor | Could become coupled to proprietary game rules | Kept as optional compatible character-sheet metaphor; no proprietary rules/catalog content |

## Revised product architecture

```text
Agents plugin
├─ Overview
│  ├─ Configuration coverage
│  ├─ Behavioral verification
│  ├─ Validation findings
│  └─ Runtime portability
├─ Agent Registry (Markdown/frontmatter; Bases-compatible)
├─ Klaus Editor
│  ├─ optional voxel world
│  └─ conventional agent inspector
├─ Requirements Academy
├─ Vault & Memory
├─ Instruction Layers
├─ Safety & Permissions
├─ Relations & Handoffs
├─ Eval Lab & Traces
├─ Runtime Adapters
├─ GURPS-compatible Character Sheet
└─ JSON Studio / Schema Validation
```

## Canonical data architecture

```text
Markdown note + frontmatter (source of truth)
        ↓
Agent Definition Model
        ├─ schema validation
        ├─ inheritance / effective configuration
        ├─ teaching requirement evaluation
        └─ runtime adapters
              ├─ AGENTS.md
              ├─ GitHub custom agent
              ├─ Agent Skill package
              ├─ MCP configuration
              └─ neutral JSON
```

Plugin settings should hold layout/preferences and configured entity folders. Agent entities should not depend on plugin-local storage in the production implementation.

## Readiness model

Avoid a single “agent readiness” score. Use four dimensions:

- **Configuration coverage** — static model fields and references.
- **Verification evidence** — scenario eval results and regressions.
- **Safety posture** — permissions, risk, guardrails and approvals relevant to the task.
- **Runtime compatibility** — whether the intended adapter can emit a valid target.

This avoids a false sense of assurance from a visually impressive percentage.

## Variant model

Production behavior should resolve variants as:

```text
Effective variant = base agent @ base version + explicit overrides
```

The UI should show:

- inherited values,
- overridden values,
- base version,
- changes in the current parent since the variant was based,
- optional rebase/accept-parent-change action.

The current prototype records inheritance/base-version/override metadata and keeps a materialized editable snapshot for simplicity.

## Implementation priorities after this prototype

### P0 — make it a real vault-native plugin

- Obsidian `manifest.json` and production bundling path.
- Markdown/frontmatter repositories using Vault/FileManager APIs.
- schema migrations.
- Bases-compatible registry/custom view.
- lazy-loaded Klaus world.
- command palette actions and settings UI.

### P1 — make agent definitions executable and testable

- adapter interface + golden-file tests.
- actual runtime exporter implementations.
- eval runner integration and trace persistence/linking.
- effective configuration resolver for inheritance.
- secret references instead of secret values.
- MCP discovery/import with approval defaults.

### P2 — deepen teaching

- “show me where to fix this” navigation from every requirement.
- evidence links from completion status to fields/files.
- guided curriculum: Foundations → Reliable → Production.
- exercises and deliberate broken examples.
- compare “good / risky / incomplete” configurations without reducing them to a single grade.

## Verification notes

- The standalone HTML JavaScript passes `node --check` after this improvement pass.
- The TypeScript domain/seed compile check reached only the expected missing `vitest` module error; no domain/seed type error was reported before dependency resolution.
- `npm install` could not complete in the execution environment, so a full Vite/Vitest build was not available in this pass.
- Headless Chromium screenshot capture is blocked/hanging in this execution environment; visual QA is therefore based on source/static inspection rather than a completed rendered-browser screenshot audit. A real Obsidian/desktop/mobile visual QA pass remains required before implementation handoff.
