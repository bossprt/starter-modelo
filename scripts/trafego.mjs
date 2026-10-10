#!/usr/bin/env node
// `npm run trafego`: registra visitas, clones e forks em docs/metrics/trafego.md.
// Rode semanalmente: o GitHub só guarda 14 dias de tráfego. Exige permissão de escrita no repositório.
// Fork novo ou salto de clones em relação ao registro anterior abre pendência (depende-de-mim):
// manter público ou tornar privado (privado com proteção exige o plano Pro ANTES).
// O arquivo alterado vai para a main por PR (só documentação: CI mínimo).

import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatTrafficRow, parseTrafficTable, toNumber, trafficAlerts } from './lib/traffic.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const FILE = join(ROOT, 'docs', 'metrics', 'trafego.md');

function gh(args, input) {
  const result = spawnSync('gh', args, { cwd: ROOT, encoding: 'utf8', input });
  if (result.status !== 0) {
    console.error(`trafego: gh ${args.slice(0, 3).join(' ')} falhou: ${(result.stderr ?? '').trim()}`);
    process.exit(2);
  }
  return result.stdout.trim().startsWith('{') || result.stdout.trim().startsWith('[') ? JSON.parse(result.stdout) : result.stdout.trim();
}

const { nameWithOwner: name } = gh(['repo', 'view', '--json', 'nameWithOwner']);
const views = gh(['api', `repos/${name}/traffic/views`]);
const clones = gh(['api', `repos/${name}/traffic/clones`]);
const repo = gh(['api', `repos/${name}`]);

const current = {
  date: new Date().toISOString().slice(0, 10),
  views: toNumber(views.count),
  uniqueViews: toNumber(views.uniques),
  clones: toNumber(clones.count),
  uniqueClones: toNumber(clones.uniques),
  forks: toNumber(repo.forks_count),
};
const previous = parseTrafficTable(readFileSync(FILE, 'utf8')).pop() ?? null;
console.log(`Medição atual: ${formatTrafficRow(current)}`);
console.log(previous ? `Anterior (${previous.date}): ${formatTrafficRow(previous)}` : 'Primeiro registro: sem comparação.');

const reasons = trafficAlerts(previous, current);
if (reasons.length > 0) {
  const body = [
    '## O que preciso que você decida',
    '',
    `O tráfego de ${name} mudou: ${reasons.join('; ')}.`,
    '',
    '| | Anterior | Atual |',
    '| --- | --- | --- |',
    `| Data | ${previous.date} | ${current.date} |`,
    `| Visitas 14d (únicos) | ${previous.views} (${previous.uniqueViews}) | ${current.views} (${current.uniqueViews}) |`,
    `| Clones 14d (únicos) | ${previous.clones} (${previous.uniqueClones}) | ${current.clones} (${current.uniqueClones}) |`,
    `| Forks (total) | ${previous.forks} | ${current.forks} |`,
    '',
    '**Pergunta: manter público ou tornar privado?**',
    '',
    '## Opções',
    '',
    '- **A. Manter público.** Nada muda; a proteção por ruleset continua valendo no plano Free.',
    '- **B. Tornar privado.** Ordem obrigatória: 1) assinar o GitHub Pro; 2) tornar privado; 3) conferir que o `npm run status` continua "protegida". Tornar privado no Free **desativa a proteção sem aviso**.',
    '',
    '## Recomendação',
    '',
    'Conferir em Insights → Traffic a tendência e as origens das visitas (referrers e páginas populares; o GitHub não identifica quem clonou). Se o repositório não tem segredo, dado de cliente nem conteúdo vendável (docs/regras/repositorio-publico.md), manter público (A). Se tem algo que não deveria ser público, B — e tratar o que vazou (revogar segredos).',
    '',
    '## O que fica bloqueado',
    '',
    'Nada é bloqueado automaticamente; é uma decisão de exposição do repositório.',
  ].join('\n');
  // A pendência é criada ANTES de gravar a medição: se falhar (gh sai do processo), nada é gravado
  // e a próxima execução compara de novo com o mesmo registro anterior (o alerta não se perde).
  const issue = gh(['issue', 'create', '--label', 'depende-de-mim', '--title', `Tráfego: ${reasons.join('; ')} — manter público ou tornar privado?`, '--body-file', '-'], body);
  console.log(`Pendência aberta: ${issue}`);
  process.exitCode = 3;
}
appendFileSync(FILE, `${formatTrafficRow(current)}\n`);
console.log('Registrado em docs/metrics/trafego.md. Leve o registro para a main por PR (só documentação).');
