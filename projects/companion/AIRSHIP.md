# Source preview and optional Airship

All generated Vue pages/components are served from source, independently of Airship. Install the project's locked dependencies explicitly, then run npm run dev:preview. The default preview is http://127.0.0.1:5173. Navigate surfaces using the preview toolbar or #surface=<surface-id>; authored route paths are metadata, not a second router.

## Optional setup

Run node bin/app airship enable to review a plan, then repeat with --yes (or --apply <reviewed-hash>). Omitted tooling is disabled. Run node bin/app airship install --yes to install the pinned CLI into .airship-tooling, outside the application package/lock. Keep dev:preview running in one terminal and run node bin/app airship start --yes in another. The default editor is http://127.0.0.1:5174. Status is read-only; doctor requires --yes because it executes third-party diagnostics. No command installs an agent, provisions credentials, enables Obsidian plugins or opens a vault.

Canonical configuration is tooling.airship in design/project.json (v6). Use --agent claude|codex|opencode and --target-port/--port on airship enable. The launcher fixes loopback, --safe and --no-commit; it rejects conflicting upstream configuration and discards AIRSHIP_* environment overrides. Safe is not a universal OS sandbox: backend permission guarantees differ. Source changes and provider credentials remain your responsibility. Review git status and commit a clean baseline before editing.

## Source and regeneration contract

Development-only data-v-inspector attributes identify authored Vue file/line/column, including component invocation sites; vendor source is not instrumented. They are absent from production and offline bundles. Airship edits real source, not project JSON. Reconcile source changes deliberately: unchanged generated output preserves edited extension files; changed output conflicts rather than overwriting them. Do not force-regenerate or automatically back-port source edits into the design model.

Disable with node bin/app airship disable --yes. This stops subsequent wrapper launches; it does not kill an existing session or remove installed caches/configuration. Stop active sessions with Ctrl-C. Airship and Storybook are independent tools; this integration does not require, install or launch Storybook. Source preview covers synthetic data and authored interactions, not native host or unimplemented business behavior.
