#!/usr/bin/env node
// UI review gallery: PNGs plus index.json and gallery.html for human review. Not acceptance, not a baseline.
import { runCli } from './gallery-cli.ts';

process.exitCode = await runCli(process.argv.slice(2));
