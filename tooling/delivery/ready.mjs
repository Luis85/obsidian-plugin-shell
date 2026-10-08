/**
 * Definition of Ready: checks the increment handoff of this pull request before implementation.
 *
 *   node tooling/delivery/ready.mjs [--base origin/main] [--handoff docs/increments/<slug>.md] [--json] [--summary <file>] [--out <dir>] [--write]
 *
 * Rules and severities: configs/delivery/definition-of-ready.json. Dependency-free; never needs node_modules.
 */
import { main } from './cli.mjs';

await main('ready');
