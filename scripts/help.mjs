import { readFileSync } from 'node:fs';
const openCommand = JSON.parse(readFileSync(new URL('../src/locales/en.json', import.meta.url), 'utf8')).command.open;
console.log(`Obsidian plugin template — available commands
npm run setup             Review identity/profile, install exact dependencies and verify
npm run setup -- --help   Identity flags, explicit native migration, dry-run and resume
npm run make -- --list    Discover integrated source recipes and their prerequisites
npm run examples:remove -- --dry-run  Review optional-example removal without deleting user features
npm run entities:check    Validate actual registered entity/document definitions
npm run entities:catalog Print the derived entity catalog (also supports --json)
npm run events:check      Check registered event contracts, metadata and references
npm run events:catalog    Print the source-derived event catalog (also supports --json)
npm run dev:ui            Real plugin UI in the browser
npm run build:local       Build/install to .dev-vault without touching notes or security settings
npm run dev:local         Rebuild and install successful changes; manually reload Obsidian
npm run verify            Current iteration's type/lint/architecture/unit/build/baseline checks
npm run test:e2e          Served real-component browser tests (provision browsers first)
npm run test:coverage     Enforce selected-core/feature coverage
npm run check:artifacts   Validate the installable bundle and CSS isolation
npm run check:security   Live all-category JSON and ordinary npm audit; registry failure is not clean
npm run test:coverage:production  Gate all production inputs plus stricter business-code coverage
npm run test:baseline     Preserved specimen/verification regression suite
npm run check:test-quality  Reject focused/skipped application/browser test declarations
npm run check:repository  Validate workflow pins/permissions, owned CSS and documentation links
npm run test:mutation     Run three targeted domain guard mutations with replay metadata
npm run maintenance:status  Report stable dependency/host freshness and compatibility blockers
npm run release:prepare -- --help  Plan consistent stable version metadata; no tag or publication
npm run release:rehearse -- --help  Qualify and retain assets from one clean fixed source commit
npm run release:plan -- --help  Validate an unexecuted draft/promotion plan and supplied evidence
npm run release:operate -- --help  Discover remote state; execution needs explicit candidate-bound authorization

Browser provisioning: node node_modules/@playwright/test/cli.js install chromium
Open .dev-vault in Obsidian, deliberately enable the plugin, then run ${openCommand}.
Native/device evidence and public release promotion remain separate explicit steps.
Release execution is opt-in; its default is read-only. Setup never disables Restricted Mode.`);
