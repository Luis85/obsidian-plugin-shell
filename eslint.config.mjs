import ts from 'typescript-eslint';
import vue from 'eslint-plugin-vue';
import obsidian from 'eslint-plugin-obsidianmd';
import { sourceRoots } from './scripts/shared/project-roots.mjs';
/** A generated project may keep product code outside src (its codebase folder, named in
 * tsconfig.project.json); that code gets the same rules, type-checked through that project file. */
const productRoots = sourceRoots(import.meta.dirname).filter(path => path !== 'src');
const pluginRules = { ...obsidian.ruleConfigs.recommended, ...obsidian.ruleConfigs.recommendedTypeChecked,
  '@typescript-eslint/no-floating-promises': 'error', '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
};
export default ts.config(
  { ignores: ['node_modules/**', 'dist/**', 'dist-harness/**', 'reports/**'] },
  ...ts.configs.recommended,
  ...vue.configs['flat/essential'],
  { files: ['src/domain/**/*.ts', 'src/application/**/*.ts', 'src/features/**/*.ts'], rules: { 'no-restricted-imports': ['error', { patterns: ['obsidian', 'vue', 'pinia', '@nuxt/*', 'node:*'] }] } },
  { files: ['src/**/*.{ts,vue}'], languageOptions: { parserOptions: { parser: ts.parser, projectService: true, extraFileExtensions: ['.vue'], tsconfigRootDir: import.meta.dirname } },
    plugins: { obsidianmd: obsidian },
    rules: pluginRules,
  },
  ...productRoots.map(root => ({ files: [`${root}/**/*.{ts,vue}`],
    languageOptions: { parserOptions: { parser: ts.parser, project: ['./tsconfig.project.json'], extraFileExtensions: ['.vue'], tsconfigRootDir: import.meta.dirname } },
    plugins: { obsidianmd: obsidian }, rules: pluginRules })),
  { files: ['tests/runtime/**/*.ts', 'tests/support/**/*.ts', 'tests/e2e/**/*.ts', 'tests/obsidian/**/*.ts', 'harness/app/**/*.ts'],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: { '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
