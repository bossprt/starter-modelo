#!/usr/bin/env node
// `npm run ruleset`: cria (ou atualiza) o ruleset proteger-main. Quem roda é o DONO, uma vez por projeto
// (é configuração de repositório, decisão do dono pela ADR 0003). Depois confere pela API.
// Aviso: tornar privado um repositório protegido no GitHub Free desativa a proteção sem aviso;
// assine o Pro ANTES de tornar privado (docs/regras/repositorio-publico.md).

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveProtection } from './lib/derive-status.mjs';
import { RULESET_NAME, REQUIRED_CHECKS, buildRulesetBody, explainRulesetError } from './lib/ruleset.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

function gh(args, input) {
  const result = spawnSync('gh', args, { cwd: ROOT, encoding: 'utf8', input });
  const text = `${result.stdout ?? ''}`;
  if (result.status !== 0) return { ok: false, error: `${result.stderr ?? ''} ${text}`.trim() };
  try {
    return { ok: true, data: text.trim() ? JSON.parse(text) : null };
  } catch {
    return { ok: true, data: text };
  }
}

const repo = gh(['repo', 'view', '--json', 'nameWithOwner,visibility,isTemplate']);
if (!repo.ok) {
  console.error(`ruleset: repositório inacessível: ${repo.error}`);
  process.exit(2);
}
const name = repo.data.nameWithOwner;
const visibility = String(repo.data.visibility).toLowerCase();
console.log(`Repositório: ${name} (${visibility})`);

const existing = gh(['api', `repos/${name}/rulesets`]);
const current = existing.ok ? (existing.data ?? []).find((ruleset) => ruleset.name === RULESET_NAME) : null;
const body = JSON.stringify(buildRulesetBody());
const write = current
  ? gh(['api', '-X', 'PUT', `repos/${name}/rulesets/${current.id}`, '--input', '-'], body)
  : gh(['api', '-X', 'POST', `repos/${name}/rulesets`, '--input', '-'], body);

if (!write.ok) {
  const explained = explainRulesetError(write.error, visibility);
  console.error(explained.message);
  process.exit(explained.planBlocked ? 3 : 1);
}
const id = write.data?.id ?? current?.id;
console.log(`${current ? 'Atualizado' : 'Criado'}: ruleset "${RULESET_NAME}" (id ${id})`);

// Confere o que ficou efetivo na main, com a mesma derivação do npm run status.
const rules = gh(['api', `repos/${name}/rules/branches/main`]);
const detail = gh(['api', `repos/${name}/rulesets/${id}`]);
const protection = deriveProtection({
  classic: { ok: false, notProtected: true },
  rules: rules.ok ? { ok: true, data: rules.data ?? [], rulesets: detail.ok ? { [id]: detail.data } : {} } : { ok: false, error: rules.error },
}, REQUIRED_CHECKS);
console.log(`Proteção da main: ${protection.state} (${protection.detail})`);
if (protection.state !== 'protegida') {
  if (visibility === 'private') console.error(explainRulesetError('make this repository public', visibility).message);
  process.exit(visibility === 'private' ? 3 : 1);
}
