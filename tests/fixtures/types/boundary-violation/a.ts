/** Negative fixture: a project that references only `plugin` imports the CLI. `vue-tsc -b` must fail with TS6307. */
import { main } from '../../../../src/cli/app.ts';
export const entry = main;
