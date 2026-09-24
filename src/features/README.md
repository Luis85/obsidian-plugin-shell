# Build your plugin here

Put business features in their own folders. Import the shared authoring helpers
from [api.ts](api.ts). The template owns validation mechanics, safe document
storage, revisions, events and lifecycle; your feature owns fields, rules and
document content.

- `entity.ts`: your data and validation.
- `definition.ts`: optional Markdown recipe and default destination.
- Additional files: your actions and business rules, as the feature needs them.
- A form adapter, when needed, converts UI text into typed entity values.

Task and Project are examples of this structure, not mandatory plugin features.
The small explicit registry in [bootstrap/features.ts](../bootstrap/features.ts)
creates typed repositories and owns their cleanup. A new feature adds one registry
entry. It does not edit `main.ts`, a host adapter, or the generic repository.

Follow [Build a feature](../../docs/development/BUILD-A-FEATURE.md) for an executable
recipe. [Authoring tools](../../docs/development/AUTHORING-TOOLS.md) generate registered
note features/entities and their real CRUD tests; [setup](../../docs/development/SETUP-IDENTITY.md)
supports reviewed identity changes, resume and explicit contained-vault settings
migration. The catalog also includes views, commands, modals, settings, events and
local custom makers. See the [framework guide](../../docs/development/FRAMEWORK-GUIDE.md)
for reusable owner scopes, persistence recovery and the path from a generated
feature to a qualified plugin.
