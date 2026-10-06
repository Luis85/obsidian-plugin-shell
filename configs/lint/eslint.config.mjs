import ts from 'typescript-eslint';
import vue from 'eslint-plugin-vue';
import obsidian from 'eslint-plugin-obsidianmd';
import { fileURLToPath } from 'node:url';
import { sourceRoots } from '../../scripts/shared/project-roots.mjs';
import { projectConfigPath, projectConfigs } from '../../scripts/shared/project-configs.mjs';
// This file lives in configs/lint; every path and tsconfig resolves from the project root.
const root = fileURLToPath(new URL('../../', import.meta.url));
/** A generated project may keep product code outside src (its codebase folder, named in
 * configs/types/tsconfig.project.json); that code gets the same rules, type-checked through that project file. */
const productRoots = sourceRoots(root).filter(path => path !== 'src');
const projectTsconfig = './' + (projectConfigPath(root, 'typescript') ?? projectConfigs.typescript.path);
const pluginRules = { ...obsidian.ruleConfigs.recommended, ...obsidian.ruleConfigs.recommendedTypeChecked,
  '@typescript-eslint/no-floating-promises': 'error', '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
};
export default ts.config(
  { ignores: ['node_modules/**', 'dist/**', 'dist-harness/**', 'reports/**'] },
  ...ts.configs.recommended,
  ...vue.configs['flat/essential'],
  { files: ['src/domain/**/*.ts', 'src/application/**/*.ts', 'src/features/**/*.ts'], rules: { 'no-restricted-imports': ['error', { patterns: ['obsidian', 'vue', 'pinia', '@nuxt/*', 'node:*'] }] } },
  { files: ['src/**/*.{ts,vue}'], languageOptions: { parserOptions: { parser: ts.parser, projectService: true, extraFileExtensions: ['.vue'], tsconfigRootDir: root } },
    plugins: { obsidianmd: obsidian },
    rules: pluginRules,
  },
  { files: ['src/cli/**/*.ts', 'plugins/**/*.ts'], languageOptions: { parserOptions: { projectService: false, project: ['./configs/types/tsconfig.maker.json'], tsconfigRootDir: root } },
    plugins: { obsidianmd: obsidian }, rules: pluginRules },
  // Companion runtime templates are copied verbatim into generated plugins; lint them as the plugin code they become.
  { files: ['templates/companion/runtime/**/*.ts'], languageOptions: { parserOptions: { project: ['./configs/types/tsconfig.generator.json'], tsconfigRootDir: root } },
    plugins: { obsidianmd: obsidian }, rules: pluginRules },
  // The launcher is maintained as an ES module; bin/app is its built copy.
  { files: ['src/cli/launcher.mjs'], languageOptions: { sourceType: 'module' } },
  { files: ['src/cli/domain/**/*.ts', 'src/cli/application/**/*.ts', 'src/cli/compiler/domain/**/*.ts', 'src/cli/compiler/application/**/*.ts', 'src/cli/documentation/domain/**/*.ts', 'src/cli/documentation/application/**/*.ts'], rules: { 'no-restricted-imports': ['error', { patterns: ['obsidian', 'vue', 'pinia', '@nuxt/*', 'node:*'] }] } },
  // The click-dummy harness runs in a plain browser outside Obsidian, so the host-API rules do not apply to it.
  ...productRoots.map(folder => ({ files: [`${folder}/**/*.{ts,vue}`],
    languageOptions: { parserOptions: { parser: ts.parser, project: [projectTsconfig], extraFileExtensions: ['.vue'], tsconfigRootDir: root } },
    ...(folder === 'harness' || folder.startsWith('harness/') ? {} : { plugins: { obsidianmd: obsidian }, rules: pluginRules }) })),
  { files: ['tests/runtime/**/*.ts', 'tests/support/**/*.ts', 'tests/e2e/**/*.ts', 'tests/obsidian/**/*.ts', 'harness/app/**/*.ts'],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: root } },
    rules: { '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
