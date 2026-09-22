// One-time online toolchain qualification, not normal install/verification.
import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
const root = resolve('.qualification');
const output = resolve(root, 'export');
mkdirSync(output, { recursive: true });
writeFileSync(resolve(root, 'package.json'), JSON.stringify({ name: 'plugin-shell', version: '0.1.0', private: true, type: 'module', devDependencies: { typescript: '6.0.3' } }, null, 2));
function run(args) {
  const npm = process.env.npm_execpath || resolve(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js');
  const result = spawnSync(process.execPath, [npm, ...args], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  process.stdout.write(result.stdout || ''); process.stderr.write(result.stderr || '');
  writeFileSync(resolve(output, `install-${args.includes('-D') ? 'dev' : 'runtime'}.log`), (result.stdout || '') + (result.stderr || ''));
  if (result.status !== 0) process.exit(result.status || 1);
}
run(['install', '--save-exact', 'vue', 'pinia', '@nuxt/ui', 'vue-i18n', 'yaml']);
run(['install', '-D', '--save-exact', 'vite', '@vitejs/plugin-vue', 'vitest', '@vitest/coverage-v8', 'typescript@6.0.3', 'vue-tsc', '@types/node@24', 'obsidian', '@playwright/test', '@vue/test-utils', 'happy-dom', 'eslint', 'eslint-plugin-vue', 'eslint-plugin-obsidianmd', 'typescript-eslint', 'oxlint', 'fallow', 'postcss', 'postcss-selector-parser', '@iconify-json/lucide']);
copyFileSync(resolve(root, 'package.json'), resolve(output, 'package.json'));
copyFileSync(resolve(root, 'package-lock.json'), resolve(output, 'package-lock.json'));
copyFileSync(process.execPath, resolve(root, 'node-qualified'));
writeFileSync(resolve(output, 'environment.json'), JSON.stringify({ node: process.version, platform: process.platform, qualifiedAt: new Date().toISOString() }, null, 2));
const audit = spawnSync(process.execPath, [resolve(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js'), 'audit', '--json'], { cwd: root, encoding: 'utf8' });
writeFileSync(resolve(output, 'audit.json'), audit.stdout || '{}');
const pack = spawnSync('tar', ['-czf', resolve(output, 'toolchain.tar.gz'), 'node_modules', 'node-qualified'], { cwd: root, stdio: 'inherit' });
if (pack.status !== 0) process.exit(pack.status || 1);
