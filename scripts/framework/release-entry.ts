/** One release entry with three explicit CLI surfaces. app.mjs is the stable bootstrap shim. */
export { main as frameworkMain } from './cli.ts';
export { main as makerMain } from '../../bin/app.ts';
export { main as memoryMain } from '../hindsight/cli.ts';
