import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'
import reactHooksPlugin from 'eslint-plugin-react-hooks'

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    plugins: {
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: false,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(_|ignore)',
        },
      ],
      'react/display-name': 'off',
      // Keep these visible but non-blocking while existing code is migrated.
      'react-hooks/error-boundaries': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/static-components': 'warn',
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    '.tmp/**',
    '**/.git/**',
    '**/.hg/**',
    '**/.pnp.*',
    '**/.svn/**',
    '**/.yarn/**',
    '**/dist/**',
    '**/node_modules/**',
    '**/temp/**',
    'playwright.config.ts',
    'jest.config.js',
  ]),
])
