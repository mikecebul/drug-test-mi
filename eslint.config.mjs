import { defineConfig, globalIgnores } from 'eslint/config'
import { fixupConfigRules } from '@eslint/compat'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

const tsRuleOverrides = {
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
}

const baseConfig = [...fixupConfigRules(nextVitals), ...fixupConfigRules(nextTypescript)].map((config) => {
  let nextConfig = config

  if (config.plugins?.['react-hooks']) {
    nextConfig = {
      ...nextConfig,
      rules: {
        ...nextConfig.rules,
        'react/display-name': 'off',
        // Keep these visible but non-blocking while existing code is migrated.
        'react-hooks/error-boundaries': 'warn',
        'react-hooks/immutability': 'warn',
        'react-hooks/purity': 'warn',
        'react-hooks/set-state-in-effect': 'warn',
        'react-hooks/static-components': 'warn',
      },
    }
  }

  if (
    nextConfig.rules &&
    (
      '@typescript-eslint/ban-ts-comment' in nextConfig.rules ||
      '@typescript-eslint/no-empty-object-type' in nextConfig.rules ||
      '@typescript-eslint/no-explicit-any' in nextConfig.rules ||
      '@typescript-eslint/no-unused-vars' in nextConfig.rules
    )
  ) {
    nextConfig = {
      ...nextConfig,
      rules: {
        ...nextConfig.rules,
        ...tsRuleOverrides,
      },
    }
  }

  return nextConfig
})

export default defineConfig([
  ...baseConfig,
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
