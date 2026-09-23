console.log(`Obsidian plugin template — available commands
npm run setup             Review identity/profile, install exact dependencies and verify
npm run setup -- --help   Identity flags, explicit native migration, dry-run and resume
npm run make -- --list    Safe note-feature/entity source scaffolding with reviewed file plans
npm run entities:check    Validate actual registered entity/document definitions
npm run entities:catalog Print the derived entity catalog (also supports --json)
npm run dev:ui            Real Nuxt UI showcase in the browser
npm run build:local       Build/install to .dev-vault without touching notes or security settings
npm run dev:local         Rebuild and install successful changes; manually reload Obsidian
npm run verify            Current iteration's type/lint/architecture/unit/build/baseline checks
npm run test:e2e          Served real-component browser tests (provision browsers first)
npm run test:coverage     Enforce selected-core/feature coverage
npm run check:artifacts   Validate the installable bundle and CSS isolation
npm run check:security   Live all-category JSON and ordinary npm audit; registry failure is not clean
npm run test:coverage:production  Gate all production inputs plus stricter business-code coverage
npm run test:baseline     Preserved specimen/verification regression suite

Browser provisioning: node node_modules/@playwright/test/cli.js install chromium
Open .dev-vault in Obsidian, deliberately enable the plugin, then run Open capability showcase.
The broader UI/custom maker catalog, mobile qualification and release promotion remain planned.
No command here publishes a release or disables Restricted Mode.`);
