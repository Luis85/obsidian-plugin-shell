/**
 * Definition of Done: checks the increment handoff against the implemented diff and generates its docs.
 *
 *   node tooling/delivery/done.mjs [--base origin/main] [--handoff docs/increments/<slug>.md] [--json] [--summary <file>] [--out <dir>] [--write] [--no-plan]
 *
 * Rules and severities: configs/delivery/definition-of-done.json. `--write` updates the handoff Completion record,
 * CHANGELOG Unreleased, docs/README.md and the handoff status; uses `node bin/app check --plan` only when installed.
 */
import { main } from './cli.mjs';

await main('done');
