console.log(`Plugin Shell — working iteration 02
npm run setup             Guided dependency install, build, tests and fixture-vault install
npm run dev:ui            Real Nuxt UI showcase in the browser
npm run build:local       Build/install to .dev-vault without touching notes or security settings
npm run dev:local         Rebuild and install successful changes; manually reload Obsidian
npm run verify            Current iteration's type/lint/architecture/unit/build/baseline checks
npm run test:e2e          Served real-component browser tests (provision browsers first)
npm run test:coverage     Measured service-core coverage; not full native/UI coverage
npm run check:artifacts   Validate the installable bundle and CSS isolation
npm run check:security   Live all-category JSON and ordinary npm audit; registry failure is not clean
npm run test:coverage:production  Whole-production coverage, reported separately from core
npm run test:baseline     Preserved specimen/verification regression suite

Browser provisioning: node node_modules/@playwright/test/cli.js install chromium
Open .dev-vault in Obsidian, deliberately enable the plugin, then run Open capability showcase.
Full maker catalog, identity migration, mobile qualification and release promotion remain planned.
No command here publishes a release or disables Restricted Mode.`);
