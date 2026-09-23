import ts from 'typescript-eslint';
import vue from 'eslint-plugin-vue';
import obsidian from 'eslint-plugin-obsidianmd';
export default ts.config(
  { ignores: ['node_modules/**', 'dist/**', 'dist-harness/**', 'reports/**'] },
  ...ts.configs.recommended,
  ...vue.configs['flat/essential'],
  { files: ['src/domain/**/*.ts', 'src/application/**/*.ts', 'src/features/**/*.ts'], rules: { 'no-restricted-imports': ['error', { patterns: ['obsidian', 'vue', 'pinia', '@nuxt/*', 'node:*'] }] } },
  { files: ['src/**/*.{ts,vue}'], languageOptions: { parserOptions: { parser: ts.parser, projectService: true, extraFileExtensions: ['.vue'], tsconfigRootDir: import.meta.dirname } },
    plugins: { obsidianmd: obsidian },
    rules: { ...obsidian.ruleConfigs.recommended, ...obsidian.ruleConfigs.recommendedTypeChecked,
      '@typescript-eslint/no-floating-promises': 'error', '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
    },
  },
);
