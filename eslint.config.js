const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const hooks = require('eslint-plugin-react-hooks');
const globals = require('globals');

module.exports = tseslint.config(
  { ignores: ['**/dist/**', '**/android/**', '**/node_modules/**', '**/test-results/**', '**/playwright-report/**', '**/reports/**', '**/.agents/**'] },
  js.configs.recommended,
  { files: ['**/*.{ts,tsx}'], extends: [...tseslint.configs.recommended] },
  { languageOptions: { globals: { ...globals.node, ...globals.browser } } },
  { files: ['eslint.config.js'], languageOptions: { sourceType: 'commonjs' } },
  {
    files: ['apps/{web,dashboard}/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': hooks },
    rules: { ...hooks.configs.recommended.rules, 'react-hooks/rules-of-hooks': 'error' }
  },
  // Ferramentas de QA: os globais que o Cypress e o k6 injetam nos próprios scripts.
  { files: ['tests/cypress/**/*.js'], languageOptions: { globals: { ...globals.mocha, cy: 'readonly', Cypress: 'readonly', expect: 'readonly' } } },
  { files: ['tests/k6/**/*.js'], languageOptions: { globals: { __ENV: 'readonly', __VU: 'readonly', __ITER: 'readonly' } } },
  // The Evolution fake accepts heterogeneous webhook bodies; keep this legacy debt visible.
  { files: ['tests/api/whatsapp.test.ts'], rules: { '@typescript-eslint/no-explicit-any': 'warn' } },
  { rules: { 'no-debugger': 'error', 'no-dupe-keys': 'error', 'no-unreachable': 'error' } }
);
