import { describe, expect, it } from 'vitest';
import { deriveProtection } from '../lib/derive-status.mjs';
import { REQUIRED_CHECKS, buildRulesetBody, explainRulesetError } from '../lib/ruleset.mjs';
import { formatTrafficRow, parseTrafficTable, trafficAlerts } from '../lib/traffic.mjs';

describe('buildRulesetBody', () => {
  const body = buildRulesetBody();

  it('PR obrigatório, validate e revisao-registrada obrigatórios, sem bypass, branch padrão', () => {
    expect(body).toMatchObject({ name: 'proteger-main', target: 'branch', enforcement: 'active', bypass_actors: [] });
    expect(body.conditions.ref_name.include).toEqual(['~DEFAULT_BRANCH']);
    expect(body.rules.map((rule) => rule.type)).toEqual(['deletion', 'non_fast_forward', 'pull_request', 'required_status_checks']);
    const checks = body.rules.find((rule) => rule.type === 'required_status_checks').parameters.required_status_checks;
    expect(checks.map((check) => check.context)).toEqual(['validate', 'revisao-registrada']);
    expect(checks.every((check) => check.integration_id === 15368)).toBe(true);
  });

  it('o ruleset gerado é "protegida" para a mesma derivação do npm run status', () => {
    const rules = body.rules.map((rule) => ({ ...rule, ruleset_id: 1 }));
    const result = deriveProtection({ classic: { ok: false, notProtected: true }, rules: { ok: true, data: rules, rulesets: { 1: body } } }, REQUIRED_CHECKS);
    expect(result.state).toBe('protegida');
  });

  it('sem regras aplicadas (privado no Free) o status é "desprotegida"', () => {
    const result = deriveProtection({ classic: { ok: false, notProtected: true }, rules: { ok: true, data: [], rulesets: {} } }, REQUIRED_CHECKS);
    expect(result.state).toBe('desprotegida');
  });
});

describe('explainRulesetError', () => {
  it('reconhece a recusa do plano (privado no GitHub Free)', () => {
    const result = explainRulesetError('gh: Upgrade to GitHub Pro or make this repository public to enable this feature. (HTTP 403)', 'private');
    expect(result.planBlocked).toBe(true);
    expect(result.message).toContain('PLANO NÃO PERMITE');
    expect(result.message).toContain('desprotegida');
  });
  it('403 em privado também é tratado como plano', () => {
    expect(explainRulesetError('HTTP 403', 'private').planBlocked).toBe(true);
  });
  it('outros erros não são confundidos com plano', () => {
    expect(explainRulesetError('HTTP 404 Not Found', 'public')).toMatchObject({ planBlocked: false });
    expect(explainRulesetError('HTTP 422 Validation Failed', 'public').message).toContain('422');
  });
});

describe('tráfego', () => {
  const table = `# Tráfego

| Data (UTC) | Visitas 14d | Visitantes únicos 14d | Clones 14d | Clonadores únicos 14d | Forks (total) |
| --- | --- | --- | --- | --- | --- |
| 2026-10-03 | 40 | 10 | 12 | 5 | 0 |
| 2026-10-10 | 55 | 14 | 15 | 6 | 1 |
`;

  it('lê as linhas da tabela e formata de volta', () => {
    const rows = parseTrafficTable(table);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual({ date: '2026-10-10', views: 55, uniqueViews: 14, clones: 15, uniqueClones: 6, forks: 1 });
    expect(formatTrafficRow(rows[1])).toBe('| 2026-10-10 | 55 | 14 | 15 | 6 | 1 |');
  });

  it('alerta em fork novo', () => {
    const [previous, current] = parseTrafficTable(table);
    expect(trafficAlerts(previous, current)).toEqual(['fork novo: 0 → 1']);
  });

  it('alerta em salto de clones (dobro e +10), não em variação pequena', () => {
    const previous = { clones: 12, forks: 0 };
    expect(trafficAlerts(previous, { clones: 24, forks: 0 })).toEqual(['salto de clones (14 dias): 12 → 24']);
    expect(trafficAlerts(previous, { clones: 20, forks: 0 })).toEqual([]);
    expect(trafficAlerts({ clones: 1, forks: 0 }, { clones: 2, forks: 0 })).toEqual([]);
  });

  it('primeira medição não alerta', () => {
    expect(trafficAlerts(null, { clones: 100, forks: 3 })).toEqual([]);
  });
});
