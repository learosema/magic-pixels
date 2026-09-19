import { defineConfig } from 'eslint/config';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

import { browser } from 'globals';

export default defineConfig(
  { ignores: ['dist', 'site', 'coverage'] },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: {
			globals: {
				...browser,
			},
		},
    rules: {
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-function': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { args: 'after-used', argsIgnorePattern: '^_' },
      ],
    },
  }
);
