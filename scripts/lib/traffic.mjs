// Tráfego do repositório (visitas, clones, forks) para docs/metrics/trafego.md. Funções puras.

const HEADER_CELLS = 6;

/** Linhas de dados da tabela de docs/metrics/trafego.md, em ordem. */
export function parseTrafficTable(markdown) {
  const rows = [];
  for (const line of String(markdown ?? '').split(/\r?\n/)) {
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells.length !== HEADER_CELLS || !/^\d{4}-\d{2}-\d{2}/.test(cells[0])) continue;
    const [date, ...numbers] = cells;
    const [views, uniqueViews, clones, uniqueClones, forks] = numbers.map(toNumber);
    rows.push({ date, views, uniqueViews, clones, uniqueClones, forks });
  }
  return rows;
}

/** Número da API ou da tabela; ausente/inválido vira null ("não disponível"), nunca zero. */
export function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = String(value ?? '').trim();
  return /^\d+$/.test(text) ? Number(text) : null;
}

const cell = (value) => (value === null || value === undefined ? 'n/d' : String(value));

export function formatTrafficRow(row) {
  return `| ${row.date} | ${cell(row.views)} | ${cell(row.uniqueViews)} | ${cell(row.clones)} | ${cell(row.uniqueClones)} | ${cell(row.forks)} |`;
}

/**
 * Motivos de alerta em relação ao registro anterior:
 * fork novo (total de forks subiu) ou salto de clones (pelo menos o dobro e +10 em relação à semana anterior).
 * Sem registro anterior ou valor não disponível: nenhum alerta para aquele número.
 */
export function trafficAlerts(previous, current) {
  if (!previous) return [];
  const reasons = [];
  const known = (value) => typeof value === 'number';
  if (known(previous.forks) && known(current.forks) && current.forks > previous.forks) reasons.push(`fork novo: ${previous.forks} → ${current.forks}`);
  if (known(previous.clones) && known(current.clones) && current.clones >= Math.max(previous.clones * 2, previous.clones + 10)) {
    reasons.push(`salto de clones (14 dias): ${previous.clones} → ${current.clones}`);
  }
  return reasons;
}
