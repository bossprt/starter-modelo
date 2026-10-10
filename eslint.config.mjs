import js from '@eslint/js';
import globals from 'globals';

// Configuração mínima do starter (scripts em .mjs). A stack do projeto (ADR 0001) acrescenta
// as regras da linguagem escolhida, por exemplo typescript-eslint.
export default [
  { ignores: ['node_modules/', 'dist/', 'coverage/', 'graphify-out/', '.agent-logs/'] },
  js.configs.recommended,
  { languageOptions: { globals: { ...globals.node } } },
];
