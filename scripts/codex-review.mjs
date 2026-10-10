#!/usr/bin/env node
// Revisão independente pelo Codex, sempre em somente leitura (ADR 0002), com registro verificável (ADR 0004)
// e teto de tokens (ADR 0006): o Codex recebe só o diff e os documentos necessários, sem ferramentas.
// Uso: node scripts/codex-review.mjs [--base main] [--task TASK-NNN] [--registrar]
// Sem --registrar: só imprime a revisão. Com --registrar: grava o resultado num commit vazio no topo da
// branch (trailers Codex-Review e Codex-Review-Tree), que o CI (revisao-registrada) e o npm run status verificam.
// Teto: DEFAULT_MAX_TOKENS em scripts/lib/review-input.mjs; o dono pode subir para UMA revisão com
// CODEX_REVIEW_MAX_TOKENS=<n>. Acima do teto (estimado antes ou medido depois): nada é registrado,
// abre-se pendência e o script sai com código 4.
// Sempre imprime tokens e a cota do Codex (janela de 5h e semanal), para docs/metrics/sessions.md e gastos.md.

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_MAX_TOKENS, DIFF_EXCLUDES, adrDecision, buildReviewPrompt, preflight } from './lib/review-input.mjs';
import { buildRecordMessage, parseVerdict } from './lib/review-record.mjs';
import { QUOTA_STOP_PERCENT, lastCodexRateLimits } from './lib/usage.mjs';

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index > -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const base = arg('--base', 'main');
const task = arg('--task', '');
const register = process.argv.includes('--registrar');
const maxTokens = Number(process.env.CODEX_REVIEW_MAX_TOKENS) || DEFAULT_MAX_TOKENS;

function git(args) {
  const result = spawnSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

if (register && git(['status', '--porcelain']) !== '') {
  console.error('codex-review: há mudanças não commitadas. Faça commit antes de revisar com --registrar.');
  process.exit(2);
}

// Localiza o pacote @openai/codex no prefixo global do npm e roda o bin/codex.js com este node.
// Assim não há shell no meio (aspas e acentos chegam intactos) e não depende do PATH.
function findCodex() {
  const npm = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['prefix', '-g'], { encoding: 'utf8', shell: process.platform === 'win32' });
  const prefix = (npm.stdout ?? '').trim();
  const roots = process.platform === 'win32' ? [prefix] : [join(prefix, 'lib')];
  for (const root of roots) {
    const entry = join(root, 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
    if (existsSync(entry)) return entry;
  }
  return null;
}

const codex = findCodex();
if (!codex) {
  console.error('codex-review: Codex CLI não encontrado (npm install -g @openai/codex). Registre "revisão: não realizada".');
  process.exit(2);
}
const codexVersion = spawnSync(process.execPath, [codex, '--version'], { encoding: 'utf8' }).stdout.trim() || 'Codex CLI';

const head = git(['rev-parse', 'HEAD']);
const tree = git(['rev-parse', 'HEAD^{tree}']);
const baseSha = git(['rev-parse', base]);

// Entrada da revisão: diff (sem arquivos gerados), tarefa, arquitetura e a seção "Decisão" de cada ADR.
const readText = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : '');
const diff = git(['diff', '--no-color', `${base}...HEAD`, '--', '.', ...DIFF_EXCLUDES]);
const diffStat = git(['diff', '--shortstat', `${base}...HEAD`, '--', '.', ...DIFF_EXCLUDES]);
const adrDir = join('docs', 'decisions');
const adrs = existsSync(adrDir)
  ? readdirSync(adrDir).filter((name) => name.endsWith('.md')).sort().map((name) => adrDecision(readText(join(adrDir, name))))
  : [];
const prompt = buildReviewPrompt({
  base,
  diff,
  task: task ? { id: task, content: readText(join('docs', 'tasks', `${task}.md`)) } : null,
  architecture: readText(join('docs', 'ARCHITECTURE.md')),
  adrs,
});

// Acima do teto: não registra; abre pendência (docs/regras/gastos.md) e sai com código 4.
function overCap(kind, tokens) {
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  const rerun = `CODEX_REVIEW_MAX_TOKENS=<n> node scripts/codex-review.mjs${task ? ` --task ${task}` : ''} --registrar`;
  console.error(`PARAR: revisão do Codex ${kind} ${tokens} tokens, acima do teto de ${maxTokens}. Nada registrado.`);
  const body = [
    '## O que preciso que você decida',
    '',
    `A revisão do Codex da branch "${branch}" ${kind} **${tokens} tokens**, acima do teto de **${maxTokens}** (ADR 0006).`,
    `Diff: ${diffStat || 'não disponível'}.`,
    '',
    '## Opções',
    '',
    '- **A. Dividir o PR** em partes menores, cada uma revisada dentro do teto.',
    `- **B. Subir o teto só para esta revisão:** "${rerun}" (consome mais cota do Codex).`,
    '- **C. Seguir sem revisão do Codex:** o PR não fica integrável (revisao-registrada é obrigatório).',
    '',
    '## Recomendação',
    '',
    'A, salvo quando o diff for indivisível (ex.: renomeação em massa); nesse caso B com o valor estimado.',
    '',
    '## O que fica bloqueado',
    '',
    'A integração desta branch.',
    ...(task ? ['', `Bloqueia: ${task}`] : []),
  ].join('\n');
  const issue = spawnSync('gh', ['issue', 'create', '--label', 'depende-de-mim', '--title', `Revisão do Codex acima do teto (${tokens} > ${maxTokens}): ${branch}`, '--body-file', '-'], { encoding: 'utf8', input: body });
  console.error(issue.status === 0
    ? `Pendência aberta: ${issue.stdout.trim()}`
    : `Não foi possível abrir a pendência (${(issue.stderr ?? '').trim()}); abra manualmente com os números acima.`);
  process.exit(4);
}

const check = preflight(prompt, maxTokens);
console.log(`entrada estimada: ${check.estimated} tokens (teto ${maxTokens}) · diff: ${diffStat || 'vazio'}`);
if (!check.ok) overCap('estimada em', check.estimated);

// windows.sandbox="unelevated": contorna o bug do sandbox elevado do Codex 0.162.x no Windows
// (os error 32 em node_repl.exe; openai/codex#52501). Somente leitura continua garantido por -s read-only.
// Sem ferramentas (ADR 0006): shell, plugins, apps, MCP, navegador, subagentes e AGENTS.md automático desligados;
// a revisão vira um único turno sobre o texto montado acima.
// Sem --ephemeral: a sessão fica em ~/.codex/sessions, de onde se lê a cota (rate_limits) e se audita a revisão.
const NO_TOOLS = ['shell_tool', 'plugins', 'apps', 'multi_agent', 'browser_use', 'computer_use', 'image_generation',
  'code_mode_host', 'skill_search', 'tool_suggest', 'goals', 'hooks', 'sleep_tool', 'in_app_browser']
  .flatMap((feature) => ['--disable', feature]);
const args = [codex, 'exec', '--json', '-s', 'read-only', '-c', 'windows.sandbox="unelevated"', ...NO_TOOLS,
  '-c', 'mcp_servers={}', '-c', 'project_doc_max_bytes=0', '-'];
const result = spawnSync(process.execPath, args, { encoding: 'utf8', input: prompt, maxBuffer: 64 * 1024 * 1024 });

let threadId = null;
let answer = '';
let usage = null;
let toolCalls = 0;
for (const line of `${result.stdout ?? ''}`.split('\n')) {
  let event;
  try {
    event = JSON.parse(line);
  } catch {
    continue;
  }
  if (event.type === 'thread.started') threadId = event.thread_id;
  if (event.type === 'item.completed' && event.item?.type === 'agent_message') answer = event.item.text;
  if (event.type === 'item.completed' && event.item && event.item.type !== 'agent_message' && event.item.type !== 'reasoning') toolCalls += 1;
  if (event.type === 'turn.completed') usage = event.usage;
}

if (result.status !== 0 || answer.trim() === '') {
  console.error(`codex-review: Codex falhou (código ${result.status}). Registre "revisão: não realizada".`);
  console.error(`${result.stderr ?? ''}`.split('\n').slice(-15).join('\n'));
  process.exit(1);
}

const tokens = usage ? usage.input_tokens + usage.output_tokens : null;
if (tokens !== null && tokens > maxTokens) overCap('usou', tokens);

// Cota do Codex: último rate_limits do arquivo da sessão (~/.codex/sessions/AAAA/MM/DD/rollout-*-<thread>.jsonl).
function readRateLimits(id) {
  const root = join(process.env.CODEX_HOME ?? join(homedir(), '.codex'), 'sessions');
  if (!id || !existsSync(root)) return null;
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) stack.push(full);
      else if (name.endsWith(`${id}.jsonl`)) return lastCodexRateLimits(readFileSync(full, 'utf8'));
    }
  }
  return null;
}
const limits = readRateLimits(threadId);

const verdict = parseVerdict(answer);
console.log(answer.trim());
console.log('');
console.log(`veredito: ${verdict ?? 'não informado pelo Codex'}`);
console.log(`tokens usados pelo Codex: ${tokens ?? 'não disponível'}${usage ? ` (entrada ${usage.input_tokens}, cache ${usage.cached_input_tokens}, saída ${usage.output_tokens})` : ''} · teto ${maxTokens} · ferramentas usadas: ${toolCalls}`);
if (limits) {
  console.log(`cota do Codex: 5h ${limits.fiveHour ?? '?'}% · semanal ${limits.weekly ?? '?'}%`);
  if ((limits.fiveHour ?? 0) >= QUOTA_STOP_PERCENT || (limits.weekly ?? 0) >= QUOTA_STOP_PERCENT) {
    console.log('ATENÇÃO: cota do Codex em 70% ou mais. Pare revisões novas e abra pendência (docs/regras/gastos.md).');
  }
} else {
  console.log('cota do Codex: não disponível');
}

if (register) {
  if (!verdict) {
    console.error('codex-review: sem linha VEREDITO na resposta; nada registrado. Rode de novo.');
    process.exit(1);
  }
  // A revisão roda em segundo plano: confere de novo que nada mudou desde o início.
  if (git(['rev-parse', 'HEAD']) !== head || git(['rev-parse', base]) !== baseSha || git(['status', '--porcelain']) !== '') {
    console.error('codex-review: HEAD, base ou árvore de trabalho mudaram durante a revisão; nada registrado. Rode de novo.');
    process.exit(1);
  }
  // Commit explicitamente vazio: mesma árvore revisada, pai = HEAD revisado. Nada do índice entra.
  const message = buildRecordMessage({ verdict, tree, base: baseSha, tokens, threadId, summary: answer, codexVersion });
  const created = spawnSync('git', ['commit-tree', tree, '-p', head, '-F', '-'], { encoding: 'utf8', input: message });
  if (created.status !== 0) {
    console.error(`codex-review: falha ao registrar: ${created.stderr}`);
    process.exit(1);
  }
  // update-ref com valor antigo: falha se HEAD andou entre a conferência e a gravação.
  git(['update-ref', '-m', 'codex-review: registro', 'HEAD', created.stdout.trim(), head]);
  console.log(`registro gravado: ${git(['rev-parse', '--short', 'HEAD'])} (Codex-Review: ${verdict})`);
}
process.exitCode = verdict === 'sem-defeito' ? 0 : 3;
