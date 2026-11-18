import type { Backup, LogEntry } from '../db/types';
import { timeLabel, todayISO } from './dates';
import { glucoseStatus } from './health';
import { mealTotals } from './selectors';

export function parseBackupText(text: string): Backup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('O arquivo não é um JSON válido.');
  }
  const data = parsed as Partial<Backup>;
  if (!data || data.app !== 'vitalis') throw new Error('Este arquivo não é um backup do Vitalis.');
  if (!Array.isArray(data.logs)) throw new Error('Backup sem registro de dados.');
  return data as Backup;
}

export function downloadText(filename: string, content: string, mime = 'application/json'): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function downloadBackup(backup: Backup): void {
  downloadText(`vitalis-backup-${todayISO()}.json`, JSON.stringify(backup, null, 2));
}

const csvCell = (value: string | number | undefined): string => {
  const text = value === undefined || value === null ? '' : String(value);
  return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function logsToCsv(logs: LogEntry[]): string {
  const header = ['tipo', 'data', 'hora', 'detalhe', 'kcal', 'carboidratos_g', 'proteina_g', 'gordura_g', 'fibra_g', 'agua_ml', 'glicemia_mgdl', 'contexto', 'peso_kg', 'insulina_u'];
  const rows: (string | number)[][] = [header];

  for (const log of [...logs].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const base = [log.kind, log.date, timeLabel(log.createdAt)];
    if (log.kind === 'meal') {
      const totals = mealTotals(log);
      rows.push([
        ...base,
        log.items.map((item) => `${item.name} (${item.grams} g)`).join(' + '),
        Math.round(totals.kcal),
        totals.carbs.toFixed(1),
        totals.protein.toFixed(1),
        totals.fat.toFixed(1),
        totals.fiber.toFixed(1),
        '', '', '', '', '',
      ]);
    } else if (log.kind === 'water') {
      rows.push([...base, log.label ?? 'Água', '', '', '', '', '', log.ml, '', '', '', '']);
    } else if (log.kind === 'glucose') {
      rows.push([...base, glucoseStatus(log.mgdl).label, '', '', '', '', '', '', log.mgdl, log.context, '', '']);
    } else if (log.kind === 'weight') {
      rows.push([...base, 'Peso', '', '', '', '', '', '', '', '', log.kg, '']);
    } else if (log.kind === 'insulin') {
      rows.push([...base, log.insulinType === 'basal' ? 'Insulina basal' : 'Insulina rápida', '', '', '', '', '', '', '', '', '', log.units]);
    }
  }

  return `\uFEFF${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}`;
}

export function downloadCsv(logs: LogEntry[]): void {
  downloadText(`vitalis-registros-${todayISO()}.csv`, logsToCsv(logs), 'text/csv');
}
