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
  { files: ['bin/**/*.ts', 'plugins/**/*.ts'], languageOptions: { parserOptions: { project: ['./configs/types/tsconfig.maker.json'], tsconfigRootDir: root } },
    plugins: { obsidianmd: obsidian }, rules: pluginRules },
  // Extensionless launcher: lint it as an ES module (the package "type" decides how Node loads it).
  { files: ['bin/app'], languageOptions: { sourceType: 'module' } },
  { files: ['bin/domain/**/*.ts', 'bin/application/**/*.ts', 'bin/compiler/domain/**/*.ts', 'bin/compiler/application/**/*.ts', 'bin/documentation/domain/**/*.ts', 'bin/documentation/application/**/*.ts'], rules: { 'no-restricted-imports': ['error', { patterns: ['obsidian', 'vue', 'pinia', '@nuxt/*', 'node:*'] }] } },
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
