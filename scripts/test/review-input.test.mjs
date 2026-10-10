import { describe, expect, it } from 'vitest';
import { CODEX_BASE_TOKENS, adrDecision, buildReviewPrompt, estimateTokens, preflight } from '../lib/review-input.mjs';

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
