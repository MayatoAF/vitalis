import type { GlucoseLog, LogEntry, MealType, MealLog, Totals, WeightLog } from '../db/types';
import { addTotals, emptyTotals } from './health';
import { addDays, lastNDays, parseISODate, toISODate } from './dates';

export const logsOfDate = (logs: LogEntry[], date: string): LogEntry[] =>
  logs.filter((log) => log.date === date).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

export const mealsOfDate = (logs: LogEntry[], date: string): MealLog[] =>
  logs.filter((log): log is MealLog => log.kind === 'meal' && log.date === date);

export const mealTotals = (meal: MealLog): Totals =>
  meal.items.reduce<Totals>((acc, item) => addTotals(acc, item), emptyTotals());

export const mealsTotals = (meals: MealLog[]): Totals =>
  meals.reduce<Totals>((acc, meal) => addTotals(acc, mealTotals(meal)), emptyTotals());

export const mealsByType = (meals: MealLog[], type: MealType): MealLog[] => meals.filter((meal) => meal.mealType === type);

export const waterTotal = (logs: LogEntry[], date: string): number =>
  logs.filter((log) => log.kind === 'water' && log.date === date).reduce((acc, log) => acc + (log.kind === 'water' ? log.ml : 0), 0);

export const waterEntries = (logs: LogEntry[], date: string) =>
  logs.filter((log) => log.kind === 'water' && log.date === date).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

export const glucoseOfDate = (logs: LogEntry[], date: string): GlucoseLog[] =>
  logs.filter((log): log is GlucoseLog => log.kind === 'glucose' && log.date === date).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

export const lastGlucose = (logs: LogEntry[]): GlucoseLog | null => {
  const all = logs.filter((log): log is GlucoseLog => log.kind === 'glucose').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return all[0] ?? null;
};

export const weightSeries = (logs: LogEntry[], days = 30): { date: string; kg: number }[] => {
  const byDate = new Map<string, WeightLog>();
  for (const log of logs) {
    if (log.kind !== 'weight') continue;
    const current = byDate.get(log.date);
    if (!current || current.createdAt < log.createdAt) byDate.set(log.date, log);
  }
  const dates = lastNDays(days);
  return dates
    .map((date) => ({ date, kg: byDate.get(date)?.kg ?? 0 }))
    .filter((point) => point.kg > 0);
};

export const latestWeight = (logs: LogEntry[], fallback: number): { kg: number; date: string | null } => {
  const weights = logs.filter((log): log is WeightLog => log.kind === 'weight').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (!weights.length) return { kg: fallback, date: null };
  return { kg: weights[0].kg, date: weights[0].date };
};

export const glucoseSeries = (logs: LogEntry[], days = 14): GlucoseLog[] => {
  const since = addDays(toISODate(new Date()), -(days - 1));
  return logs
    .filter((log): log is GlucoseLog => log.kind === 'glucose' && log.date >= since)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
};

export interface DaySummary {
  date: string;
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
  water: number;
  glucoseAvg: number;
  glucoseCount: number;
}

export const daySummaries = (logs: LogEntry[], days = 7, endDate = toISODate(new Date())): DaySummary[] => {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(endDate, i - (days - 1));
    const dayLogs = logsOfDate(logs, date);
    const totals = mealsTotals(dayLogs.filter((log): log is MealLog => log.kind === 'meal'));
    const glucoses = dayLogs.filter((log): log is GlucoseLog => log.kind === 'glucose');
    return {
      date,
      kcal: totals.kcal,
      carbs: totals.carbs,
      protein: totals.protein,
      fat: totals.fat,
      water: waterTotal(logs, date),
      glucoseAvg: glucoses.length ? glucoses.reduce((acc, g) => acc + g.mgdl, 0) / glucoses.length : 0,
      glucoseCount: glucoses.length,
    };
  });
};

export const weekTotals = (logs: LogEntry[], days = 7) => {
  const summaries = daySummaries(logs, days);
  const logged = summaries.filter((summary) => summary.kcal > 0);
  return {
    summaries,
    avgKcal: logged.length ? logged.reduce((acc, s) => acc + s.kcal, 0) / logged.length : 0,
    avgCarbs: logged.length ? logged.reduce((acc, s) => acc + s.carbs, 0) / logged.length : 0,
    waterDays: summaries.filter((s) => s.water > 0).length,
    totalWater: summaries.reduce((acc, s) => acc + s.water, 0),
  };
};

export const uniqueDatesWithLogs = (logs: LogEntry[]): string[] => [...new Set(logs.map((log) => log.date))].sort();

export function formatWeekday(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(parseISODate(date)).replace('.', '');
}
