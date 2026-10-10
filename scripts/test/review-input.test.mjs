import { describe, expect, it } from 'vitest';
import { CODEX_BASE_TOKENS, DEFAULT_MAX_TOKENS, adrDecision, buildReviewPrompt, estimateTokens, parseMaxTokens, preflight, summarizeCodexEvents, taskReviewError } from '../lib/review-input.mjs';

describe('estimateTokens', () => {
  it('~3 caracteres por token, arredondando para cima', () => {
    expect(estimateTokens('abc')).toBe(1);
    expect(estimateTokens('abcd')).toBe(2);
    expect(estimateTokens('')).toBe(0);
  });
});

describe('adrDecision', () => {
  it('pega o título e só a seção Decisão', () => {
    const md = '# 0009 — Exemplo\n\n## Contexto\n\nlongo\n\n## Decisão\n\n1. Fazer X.\n\n## Consequências\n\nY';
    expect(adrDecision(md)).toBe('# 0009 — Exemplo\n1. Fazer X.');
  });
  it('ADR sem seção Decisão é indicada', () => {
    expect(adrDecision('# 0001 — Stack\n\nA PREENCHER')).toContain('sem seção "Decisão"');
  });
});

describe('buildReviewPrompt', () => {
  const prompt = buildReviewPrompt({ base: 'main', diff: '+linha', task: { id: 'TASK-001', content: 'critérios' }, architecture: 'restrições', adrs: ['# 0002\nCodex revisa'] });
  it('proíbe ferramentas, inclui diff, tarefa, arquitetura e decisões, e pede o veredito', () => {
    expect(prompt).toContain('NÃO execute comandos nem ferramentas');
    expect(prompt).toContain('graphify');
    expect(prompt).toContain('+linha');
    expect(prompt).toContain('TASK-001');
    expect(prompt).toContain('restrições');
    expect(prompt).toContain('Codex revisa');
    expect(prompt).toContain('VEREDITO: sem-defeito');
  });
});

describe('preflight (teto)', () => {
  it('dentro do teto', () => {
    expect(preflight('x'.repeat(30_000), 60_000)).toEqual({ estimated: CODEX_BASE_TOKENS + 10_000, maxTokens: 60_000, ok: true });
  });
  it('acima do teto não chama o Codex', () => {
    expect(preflight('x'.repeat(150_000), 60_000).ok).toBe(false);
  });
});

describe('parseMaxTokens', () => {
  it('ausente usa o padrão; inteiro positivo vale', () => {
    expect(parseMaxTokens(undefined)).toBe(DEFAULT_MAX_TOKENS);
    expect(parseMaxTokens('')).toBe(DEFAULT_MAX_TOKENS);
    expect(parseMaxTokens('90000')).toBe(90000);
  });
  it('Infinity, negativo, zero, decimal e texto são inválidos', () => {
    for (const value of ['Infinity', '-5', '0', '1.5', 'abc', '1e9']) expect(parseMaxTokens(value)).toBeNull();
  });
});

describe('summarizeCodexEvents', () => {
  const line = (event) => JSON.stringify(event);
  it('soma o uso de todos os turnos e conta turnos', () => {
    const out = [
      line({ type: 'thread.started', thread_id: 't1' }),
      line({ type: 'turn.completed', usage: { input_tokens: 100, cached_input_tokens: 10, output_tokens: 5 } }),
      line({ type: 'item.completed', item: { type: 'agent_message', text: 'ok' } }),
      line({ type: 'turn.completed', usage: { input_tokens: 50, cached_input_tokens: 0, output_tokens: 1 } }),
    ].join('\n');
    expect(summarizeCodexEvents(out)).toEqual({ threadId: 't1', answer: 'ok', usage: { input_tokens: 150, cached_input_tokens: 10, output_tokens: 6 }, usageComplete: true, toolCalls: [], turns: 2 });
  });
  it('registra ferramenta real e ignora itens que não são ferramenta', () => {
    const out = [
      line({ type: 'item.completed', item: { type: 'reasoning' } }),
      line({ type: 'item.completed', item: { type: 'todo_list' } }),
      line({ type: 'item.started', item: { type: 'command_execution' } }),
      line({ type: 'item.completed', item: { type: 'command_execution' } }),
    ].join('\n');
    expect(summarizeCodexEvents(out).toolCalls).toEqual(['command_execution']);
  });
  it('turn.completed sem usage ou com consumo parcial: uso nulo, nunca zero', () => {
    expect(summarizeCodexEvents(line({ type: 'turn.completed' }))).toMatchObject({ usage: null, usageComplete: false, turns: 1 });
    expect(summarizeCodexEvents(line({ type: 'turn.completed', usage: { input_tokens: 10 } }))).toMatchObject({ usage: null, usageComplete: false });
    const mixed = [line({ type: 'turn.completed', usage: { input_tokens: 10, output_tokens: 1 } }), line({ type: 'turn.completed', usage: { input_tokens: 'x', output_tokens: 1 } })].join('\n');
    // O total já medido é mantido (para o teto); a medição fica incompleta (impede o registro).
    expect(summarizeCodexEvents(mixed)).toMatchObject({ usage: { input_tokens: 10, output_tokens: 1 }, usageComplete: false });
  });
  it('sem turn.completed: uso nulo (consumo não informado)', () => {
    expect(summarizeCodexEvents(line({ type: 'item.completed', item: { type: 'agent_message', text: 'x' } }))).toMatchObject({ usage: null, usageComplete: false, turns: 0 });
  });
});

describe('taskReviewError', () => {
  it('tarefa existente e com conteúdo serve', () => {
    expect(taskReviewError('TASK-001', 'docs/tasks/TASK-001.md', '---\nid: TASK-001\n---\ncritérios')).toBeNull();
  });
  it('arquivo inexistente encerra antes de chamar o Codex', () => {
    expect(taskReviewError('TASK-009', 'docs/tasks/TASK-009.md', null)).toBe('tarefa TASK-009 não encontrada em docs/tasks/TASK-009.md');
  });
  it('arquivo vazio ou só espaços também encerra', () => {
    expect(taskReviewError('TASK-001', 'docs/tasks/TASK-001.md', '  \n')).toContain('vazia');
  });
  it('id fora do formato TASK-NNN é recusado', () => {
    expect(taskReviewError('../segredo', 'x', 'conteúdo')).toContain('--task inválido');
    expect(taskReviewError('TASK-1', 'x', 'conteúdo')).toContain('--task inválido');
  });
});
