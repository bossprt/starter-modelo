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
