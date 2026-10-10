#!/usr/bin/env node
// `npm run validate`: mesmo comando local, no hook do Claude Code e no CI.
// Etapas do starter: lint, testes e checagens de estrutura. Etapas do projeto: `typecheck` e `build`,
// rodadas só se existirem em package.json (a stack do projeto é escolhida na ADR 0001).
// Roda todas as etapas e falha no fim se alguma falhou.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const BIN = (name) => join(ROOT, 'node_modules', name);
const scripts = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts ?? {};
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const steps = [
  { name: 'lint', command: process.execPath, args: [BIN('eslint/bin/eslint.js'), '.'] },
  ...['typecheck', 'build'].filter((name) => scripts[name]).map((name) => ({ name, command: npm, args: ['run', '--silent', name], shell: process.platform === 'win32' })),
  { name: 'testes', command: process.execPath, args: [BIN('vitest/vitest.mjs'), 'run'] },
  { name: 'estrutura', command: process.execPath, args: [join(ROOT, 'scripts', 'check-structure.mjs')] },
];

const failed = [];
for (const step of steps) {
  console.log(`\n== ${step.name}`);
  const result = spawnSync(step.command, step.args, { cwd: ROOT, stdio: 'inherit', shell: step.shell ?? false });
  if (result.status !== 0) failed.push(step.name);
}

console.log('');
if (failed.length > 0) {
  console.error(`validate: FALHOU em ${failed.join(', ')}`);
  process.exit(1);
}
console.log('validate: ok');
