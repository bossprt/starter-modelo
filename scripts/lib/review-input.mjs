// Entrada da revisão do Codex (ADR 0006): só o diff e os documentos necessários, num único texto.
// O Codex não executa ferramentas; revisa apenas o que recebe. Funções puras.

// Teto padrão de tokens por revisão (entrada + saída). Mudar é decisão do dono (docs/regras/gastos.md).
export const DEFAULT_MAX_TOKENS = 60_000;
// Contexto fixo do Codex com ferramentas, plugins e AGENTS.md desligados (medido em 2026-10-10: 14.210).
export const CODEX_BASE_TOKENS = 15_000;
// Arquivos que não valem revisão linha a linha (gerados).
export const DIFF_EXCLUDES = [':(exclude)package-lock.json', ':(exclude)graphify-out/**'];

/** Estimativa conservadora: ~3 caracteres por token (português e código). */
export function estimateTokens(text) {
  return Math.ceil(String(text ?? '').length / 3);
}

/** Seção "## Decisão" de uma ADR (o que importa para checar conflito), com o título. */
export function adrDecision(markdown) {
  const text = String(markdown ?? '').replace(/\r\n/g, '\n');
  const title = text.split('\n')[0] ?? '';
  const match = /\n## Decisão\n([\s\S]*?)(?=\n## |\s*$)/.exec(text);
  return `${title}\n${match ? match[1].trim() : '(sem seção "Decisão")'}`;
}

/**
 * Monta o prompt completo da revisão.
 * @param {{ base: string, diff: string, task?: { id: string, content: string } | null, architecture: string, adrs: string[] }} input
 */
export function buildReviewPrompt({ base, diff, task, architecture, adrs }) {
  return [
    'Você é revisor independente. NÃO execute comandos nem ferramentas de nenhum tipo (nem graphify, nem git,',
    'nem testes, nem leitura de arquivos): revise SOMENTE o texto abaixo. Não altere nada.',
    'Avalie: correção (critérios de aceite e casos de borda), segurança, manutenção e conflito com as decisões',
    'e restrições abaixo. Liste achados com severidade (alta/média/baixa), arquivo:linha e sugestão.',
    'Se não houver defeito real, diga explicitamente.',
    'Termine com uma única linha, exatamente "VEREDITO: sem-defeito" ou "VEREDITO: com-defeito".',
    '',
    task ? `=== Tarefa ${task.id} (docs/tasks/${task.id}.md)\n${task.content}` : '=== Tarefa: nenhuma informada (PR de starter ou documentação)',
    '',
    `=== docs/ARCHITECTURE.md\n${architecture}`,
    '',
    `=== Decisões (seção "Decisão" de cada ADR)\n${adrs.join('\n\n')}`,
    '',
    `=== git diff ${base}...HEAD (sem package-lock.json e graphify-out/)\n${diff}`,
  ].join('\n');
}

/** Teto antes de chamar o Codex: estimativa da entrada + base fixa. */
export function preflight(prompt, maxTokens = DEFAULT_MAX_TOKENS) {
  const estimated = CODEX_BASE_TOKENS + estimateTokens(prompt);
  return { estimated, maxTokens, ok: estimated <= maxTokens };
}

/** Teto vindo do ambiente: ausente = padrão; inteiro positivo = esse valor; qualquer outra coisa = null (inválido). */
export function parseMaxTokens(value) {
  if (value === undefined || String(value).trim() === '') return DEFAULT_MAX_TOKENS;
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) return null;
  const number = Number(text);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

// Tipos de item do codex exec --json que são uso de ferramenta (qualquer um invalida a revisão sem ferramentas).
const TOOL_ITEM_TYPES = ['command_execution', 'file_change', 'mcp_tool_call', 'web_search', 'collab_tool_call', 'tool_call'];

const isCount = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;

/**
 * Resume os eventos do codex exec --json: resposta final, uso somado dos turnos com consumo informado,
 * se a medição está completa (todo turno informou consumo), ferramentas e turnos.
 */
export function summarizeCodexEvents(stdout) {
  const summary = { threadId: null, answer: '', usage: null, usageComplete: true, toolCalls: [], turns: 0 };
  for (const line of String(stdout ?? '').split('\n')) {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (event.type === 'thread.started') summary.threadId = event.thread_id;
    if (event.type === 'item.completed' && event.item?.type === 'agent_message') summary.answer = event.item.text ?? '';
    if ((event.type === 'item.started' || event.type === 'item.completed') && TOOL_ITEM_TYPES.includes(event.item?.type)
      && !summary.toolCalls.includes(event.item.type)) summary.toolCalls.push(event.item.type);
    if (event.type === 'turn.completed') {
      summary.turns += 1;
      const u = event.usage ?? {};
      // Cada contador soma sozinho quando é válido: o mínimo conhecido vale para o teto. Contador ausente ou
      // inválido não vira zero; só marca a medição como incompleta (o que impede o registro).
      if (!isCount(u.input_tokens) || !isCount(u.output_tokens)) summary.usageComplete = false;
      for (const key of ['input_tokens', 'cached_input_tokens', 'output_tokens']) {
        if (!isCount(u[key])) continue;
        summary.usage ??= { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 };
        summary.usage[key] += u[key];
      }
    }
  }
  if (summary.turns === 0) summary.usageComplete = false;
  return summary;
}

/**
 * Tarefa informada em --task precisa existir e ter conteúdo; senão a revisão não confere critérios de aceite.
 * @returns {string | null} mensagem de erro, ou null se a tarefa serve para a revisão
 */
export function taskReviewError(id, path, content) {
  if (!/^TASK-\d{3}$/.test(String(id ?? ''))) return `--task inválido: "${id}" (formato TASK-NNN)`;
  if (content === null) return `tarefa ${id} não encontrada em ${path}`;
  if (String(content).trim() === '') return `tarefa ${id} vazia em ${path}`;
  return null;
}
