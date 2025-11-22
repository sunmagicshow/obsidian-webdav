import js from '@eslint/js';
import typescriptParser from '@typescript-eslint/parser';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import obsidianmd from 'eslint-plugin-obsidianmd';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    plugins: {
      '@typescript-eslint': typescriptEslint,
      obsidianmd,
    },
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: {
        console: 'readonly',
        File: 'readonly',
        Blob: 'readonly',
        FormData: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        Uint8Array: 'readonly',
      },
    },
    rules: {
      // TypeScript 规则
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',

      // Obsidian 插件特定规则
      'obsidianmd/validate-manifest': 'error',
      'obsidianmd/no-tfile-tfolder-cast': 'error',
      'obsidianmd/commands/no-command-in-command-id': 'error',
      'obsidianmd/commands/no-plugin-id-in-command-id': 'error',

      // 警告级别的规则
      'obsidianmd/no-forbidden-elements': 'warn',
      'obsidianmd/no-static-styles-assignment': 'warn',
      'obsidianmd/platform': 'warn',
      'obsidianmd/regex-lookbehind': 'warn',

      // 关闭 no-undef，因为 TypeScript 已经处理了类型检查
      'no-undef': 'off',
    },
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      globals: {
        console: 'readonly',
        module: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
      },
    },
  },
  {
    ignores: [
      'dist/**',
      'node_modules/**',
    ],
  },
];