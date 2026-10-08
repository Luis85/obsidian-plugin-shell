import ts from 'typescript-eslint';
import vue from 'eslint-plugin-vue';
import obsidian from 'eslint-plugin-obsidianmd';
import { fileURLToPath } from 'node:url';
import { sourceRoots } from '../../src/shared/platform/project-roots.mjs';
import { projectConfigPath, projectConfigs } from '../../src/shared/platform/project-configs.mjs';
import { lintExclusionGlobs } from './lint-scope.mjs';
// This file lives in configs/lint; every path and tsconfig resolves from the project root.
const root = fileURLToPath(new URL('../../', import.meta.url));
/** A generated project may keep product code outside src (its codebase folder, named in
 * configs/types/tsconfig.project.json); that code gets the same rules, type-checked through that project file. */
const roots = sourceRoots(root);
const productRoots = roots.filter(path => path !== 'src');
// Flat consumers, named source projects and configured product roots share the same pure-layer boundary.
const pureLayers = [...roots.map(folder => `${folder}/{domain,application,features}/**/*.ts`), 'src/*/{domain,application,features}/**/*.ts'];
const sourceSupport = ['src/*/tests/**', 'src/*/harness/**'];
const projectTsconfig = './' + (projectConfigPath(root, 'typescript') ?? projectConfigs.typescript.path);
const pluginRules = { ...obsidian.ruleConfigs.recommended, ...obsidian.ruleConfigs.recommendedTypeChecked,
  '@typescript-eslint/no-floating-promises': 'error', '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
};
export default ts.config(
  { ignores: ['node_modules/**', 'dist/**', 'dist-harness/**', 'reports/**'] },
  // Historical support scope: shell globs, or exact compiler-receipted support files in generated projects.
  // One list, shared with tooling/quality/lint-source.mjs; the eslint-tests step lints the test folders with --no-ignore.
  { ignores: lintExclusionGlobs(root) },
  ...ts.configs.recommended,
  ...vue.configs['flat/essential'],
  { files: pureLayers, rules: { 'no-restricted-imports': ['error', { patterns: ['obsidian', 'vue', 'pinia', '@nuxt/*', 'node:*'] }] } },
  // The plugin-code rules never covered tests or the harness (they lived outside src): those files take only the test block below.
  { files: ['src/**/*.{ts,vue}'], ignores: sourceSupport, languageOptions: { parserOptions: { parser: ts.parser, projectService: true, extraFileExtensions: ['.vue'], tsconfigRootDir: root } },
    plugins: { obsidianmd: obsidian },
    rules: pluginRules,
  },
  { files: ['src/cli/**/*.ts', 'src/cli/sdk/**/*.ts'], ignores: sourceSupport, languageOptions: { parserOptions: { projectService: false, project: ['./configs/types/tsconfig.maker.json'], tsconfigRootDir: root } },
    plugins: { obsidianmd: obsidian }, rules: pluginRules },
  // Companion runtime templates are copied verbatim into generated plugins; lint them as the plugin code they become.
  { files: ['templates/companion/runtime/**/*.ts'], languageOptions: { parserOptions: { project: ['./configs/types/tsconfig.generator.json'], tsconfigRootDir: root } },
    plugins: { obsidianmd: obsidian }, rules: pluginRules },
  // The launcher is maintained as an ES module; bin/app is its built copy.
  { files: ['src/cli/launcher.mjs'], languageOptions: { sourceType: 'module' } },
  { files: ['src/cli/domain/**/*.ts', 'src/cli/application/**/*.ts', 'src/cli/compiler/domain/**/*.ts', 'src/cli/compiler/application/**/*.ts', 'src/cli/documentation/domain/**/*.ts', 'src/cli/documentation/application/**/*.ts'], rules: { 'no-restricted-imports': ['error', { patterns: ['obsidian', 'vue', 'pinia', '@nuxt/*', 'node:*'] }] } },
  // The click-dummy harness runs in a plain browser outside Obsidian, so the host-API rules do not apply to it.
  ...productRoots.map(folder => ({ files: [`${folder}/**/*.{ts,vue}`], ignores: [...sourceSupport, `${folder}/tests/**`, `${folder}/harness/**`],
    languageOptions: { parserOptions: { parser: ts.parser, project: [projectTsconfig], extraFileExtensions: ['.vue'], tsconfigRootDir: root } },
    ...(folder === 'harness' || folder.startsWith('harness/') ? {} : { plugins: { obsidianmd: obsidian }, rules: pluginRules }) })),
  // Generated projects keep the same named source tests/harness as the shell; legacy flat projects keep root tests/harness.
  // Both receive the dedicated typed test rules, including when an external product-root overlay also matches the file.
  { files: ['tests/{runtime,support,e2e,obsidian}/**/*.ts', 'src/*/tests/**/*.ts', 'tooling/tests/**/*.ts',
      'src/*/harness/app/**/*.ts', 'harness/app/**/*.ts', ...productRoots.flatMap(folder => [`${folder}/tests/**/*.ts`, `${folder}/harness/app/**/*.ts`])],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: root } },
    rules: { '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
