// Tráfego do repositório (visitas, clones, forks) para docs/metrics/trafego.md. Funções puras.

const HEADER_CELLS = 6;

/** Linhas de dados da tabela de docs/metrics/trafego.md, em ordem. */
export function parseTrafficTable(markdown) {
  const rows = [];
  for (const line of String(markdown ?? '').split(/\r?\n/)) {
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells.length !== HEADER_CELLS || !/^\d{4}-\d{2}-\d{2}/.test(cells[0])) continue;
    const [date, views, uniqueViews, clones, uniqueClones, forks] = cells;
    rows.push({ date, views: Number(views), uniqueViews: Number(uniqueViews), clones: Number(clones), uniqueClones: Number(uniqueClones), forks: Number(forks) });
  }
  return rows;
}

export function formatTrafficRow(row) {
  return `| ${row.date} | ${row.views} | ${row.uniqueViews} | ${row.clones} | ${row.uniqueClones} | ${row.forks} |`;
}

/**
 * Motivos de alerta em relação ao registro anterior:
 * fork novo (total de forks subiu) ou salto de clones (pelo menos o dobro e +10 em relação à semana anterior).
 * Sem registro anterior: nenhum alerta (primeira medição).
 */
export function trafficAlerts(previous, current) {
  if (!previous) return [];
  const reasons = [];
  if (current.forks > previous.forks) reasons.push(`fork novo: ${previous.forks} → ${current.forks}`);
  if (current.clones >= Math.max(previous.clones * 2, previous.clones + 10)) {
    reasons.push(`salto de clones (14 dias): ${previous.clones} → ${current.clones}`);
  }
  return reasons;
}
