import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { args, need, readBytes, readJson, readText, sha256, noLinks, isMain, cli } from './lib/io.mjs';

const FILES = [
  'AGENTS.md', 'package.json', 'package-lock.json', '.nvmrc', 'shell.mjs',
  'scripts/companion/authoring-contract.ts', 'scripts/companion/read-project.mjs',
  'scripts/companion/generate.mjs', 'scripts/companion/visual/visual-validate.mjs',
  'docs/development/COMPANION-PROJECT-JSON.md', 'docs/development/COMPANION-GENERATOR.md',
  'docs/concepts/companion/VISUAL-EDITORS.md',
];
const PINS = ['vue', 'pinia', '@nuxt/ui', 'typescript', 'vite', '@vitejs/plugin-vue',
  'vitest', '@vue/test-utils', '@playwright/test', 'vue-tsc'];
function git(repo, command) {
  const result = spawnSync('git', ['--no-optional-locks', '-c', 'core.fsmonitor=false', '-C', repo, ...command], { encoding: 'utf8', timeout: 10000 });
  return result.status === 0 ? result.stdout.trim() : null;
}
export function inspectRepository(directory) {
  const repo = noLinks(directory);
  if (!fs.statSync(repo).isDirectory()) throw new Error('Repository must be a directory');
  const pkg = readJson(path.join(repo, 'package.json'));
  const lock = readJson(path.join(repo, 'package-lock.json'));
  const source = readText(path.join(repo, 'scripts/companion/authoring-contract.ts'));
  const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
  const files = FILES.map(file => {
    try { return { path: file, sha256: sha256(readBytes(path.join(repo, file))) }; }
    catch (error) { return { path: file, error: error.message }; }
  });
  const pins = Object.fromEntries(PINS.map(name => [name, {
    declared: dependencies[name] ?? null,
    locked: lock.packages?.[`node_modules/${name}`]?.version ?? null,
  }]));
  const numberConstant = name => {
    const text = source.match(new RegExp(`export const ${name}\\s*=\\s*([0-9_]+)\\s*;`))?.[1];
    return text ? Number(text.replaceAll('_', '')) : null;
  };
  return {
    kind: 'prototype-repository-inspection', schemaVersion: 1,
    status: 'inspection-only-not-verification',
    git: { commit: git(repo, ['rev-parse', 'HEAD']), branch: git(repo, ['branch', '--show-current']),
      dirty: git(repo, ['status', '--porcelain']) },
    toolchain: { node: fs.existsSync(path.join(repo, '.nvmrc')) ? readText(path.join(repo, '.nvmrc')).trim() : null,
      packageManager: pkg.packageManager ?? null, engines: pkg.engines ?? null },
    pins, contract: { version: numberConstant('AUTHORING_VERSION'), maxBytes: numberConstant('COMPANION_MAX_BYTES') },
    commands: Object.fromEntries(Object.entries(pkg.scripts ?? {}).filter(([key]) =>
      ['companion:generate', 'companion:scaffold', 'check', 'verify', 'typecheck', 'build', 'test'].includes(key))),
    files,
    limitations: ['Static core-file sample only; inspect transitive validators/compiler/templates.',
      'No repository commands, dependencies, browser checks or native acceptance executed.',
      'Unknown constants remain null; never infer a compatible version.'],
  };
}
if (isMain(import.meta.url)) cli(() => {
  const options = args(process.argv.slice(2), ['--repo'], ['--help']);
  if (options.help) return console.log('Usage: node inspect-repository.mjs --repo <trusted-checkout>');
  console.log(JSON.stringify(inspectRepository(need(options, 'repo')), null, 2));
});
