import { ACTIVITY_LABELS, type Goals, type Profile, type Totals } from '../db/types';
import { ageFromBirth } from './dates';

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function safeNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export interface MetabolicResult {
  bmr: number;
  tdee: number;
  kcal: number;
}

export function calcBMR(profile: Profile): number {
  const age = ageFromBirth(profile.birthDate) ?? 30;
  const base = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * age;
  const sexAdjust = profile.sex === 'm' ? 5 : profile.sex === 'f' ? -161 : -78;
  return Math.max(1000, base + sexAdjust);
}

export function calcMetabolic(profile: Profile): MetabolicResult {
  const bmr = calcBMR(profile);
  const tdee = bmr * ACTIVITY_LABELS[profile.activity].factor;
  let kcal = tdee;
  const dailyDelta = (Math.max(0, profile.rateKgWeek) * 7700) / 7;

  if (profile.goal === 'perder') kcal = tdee - dailyDelta;
  else if (profile.goal === 'ganhar') kcal = tdee + dailyDelta * 0.7;

  const floor = profile.sex === 'm' ? 1500 : 1200;
  kcal = Math.max(floor, kcal);
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), kcal: roundTo(kcal, 10) };
}

export function calcGoals(profile: Profile): Goals {
  const metabolic = calcMetabolic(profile);
  const kcal = profile.calorieGoal > 0 ? profile.calorieGoal : metabolic.kcal;

  const protein = profile.proteinGoalG > 0 ? profile.proteinGoalG : Math.round(clamp(profile.weightKg * 1.6, 50, 220));
  const fat = profile.fatGoalG > 0 ? profile.fatGoalG : Math.round((kcal * 0.28) / 9);
  const remaining = kcal - protein * 4 - fat * 9;
  const carbs = profile.carbGoalG > 0 ? profile.carbGoalG : Math.max(40, Math.round(remaining / 4));
  const fiber = profile.fiberGoalG > 0 ? profile.fiberGoalG : Math.round(clamp((kcal / 1000) * 14, 20, 40));

  return {
    ...metabolic,
    kcal,
    protein,
    carbs,
    fat,
    fiber,
    waterMl: profile.waterGoalMl > 0 ? profile.waterGoalMl : roundTo(clamp(profile.weightKg * 35, 1500, 4200), 50),
  };
}

export function calcBMI(weightKg: number, heightCm: number): number {
  if (!weightKg || !heightCm) return 0;
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export interface BMICategory {
  label: string;
  tone: 'mint' | 'cyan' | 'amber' | 'rose';
}

export function bmiCategory(bmi: number): BMICategory {
  if (bmi < 18.5) return { label: 'Abaixo do peso', tone: 'cyan' };
  if (bmi < 25) return { label: 'Peso saudável', tone: 'mint' };
  if (bmi < 30) return { label: 'Sobrepeso', tone: 'amber' };
  if (bmi < 35) return { label: 'Obesidade grau I', tone: 'rose' };
  if (bmi < 40) return { label: 'Obesidade grau II', tone: 'rose' };
  return { label: 'Obesidade grau III', tone: 'rose' };
}

export function idealWeightRange(heightCm: number): [number, number] {
  const m = heightCm / 100;
  return [Math.round(18.5 * m * m * 10) / 10, Math.round(24.9 * m * m * 10) / 10];
}

export const emptyTotals = (): Totals => ({ kcal: 0, carbs: 0, protein: 0, fat: 0, fiber: 0 });

export function addTotals(a: Totals, b: Totals): Totals {
  return {
    kcal: a.kcal + b.kcal,
    carbs: a.carbs + b.carbs,
    protein: a.protein + b.protein,
    fat: a.fat + b.fat,
    fiber: a.fiber + b.fiber,
  };
}

export function ratio(value: number, goal: number): number {
  if (!goal || goal <= 0) return 0;
  return clamp(value / goal, 0, 1.5);
}

export function progressPct(value: number, goal: number): number {
  return clamp(Math.round((value / Math.max(1, goal)) * 100), 0, 999);
}

export type GlucoseTone = 'low' | 'range' | 'high' | 'veryHigh' | 'veryLow';

export interface GlucoseStatus {
  tone: GlucoseTone;
  label: string;
  color: string;
}

export function glucoseStatus(mgdl: number, low = 70, high = 180): GlucoseStatus {
  if (mgdl < 54) return { tone: 'veryLow', label: 'Hipoglicemia grave', color: '#ff5d7a' };
  if (mgdl < low) return { tone: 'low', label: 'Hipoglicemia', color: '#ff9f6b' };
  if (mgdl <= high) return { tone: 'range', label: 'Na meta', color: '#2fe0b0' };
  if (mgdl <= 250) return { tone: 'high', label: 'Acima da meta', color: '#ffc65c' };
  return { tone: 'veryHigh', label: 'Muito alta', color: '#ff5d7a' };
}

export interface GlucoseStats {
  count: number;
  avg: number;
  min: number;
  max: number;
  sd: number;
  cv: number;
  inRange: number;
  low: number;
  veryLow: number;
  high: number;
  veryHigh: number;
  gmi: number;
  eA1c: number;
}

export function glucoseStats(values: number[], low = 70, high = 180): GlucoseStats {
  const valid = values.filter((v) => Number.isFinite(v) && v > 0);
  const count = valid.length;
  if (!count) {
    return { count: 0, avg: 0, min: 0, max: 0, sd: 0, cv: 0, inRange: 0, low: 0, veryLow: 0, high: 0, veryHigh: 0, gmi: 0, eA1c: 0 };
  }
  const sum = valid.reduce((acc, v) => acc + v, 0);
  const avg = sum / count;
  const variance = valid.reduce((acc, v) => acc + (v - avg) ** 2, 0) / count;
  const sd = Math.sqrt(variance);

  const pct = (n: number) => (n / count) * 100;
  const veryLow = valid.filter((v) => v < 54).length;
  const lowOnly = valid.filter((v) => v >= 54 && v < low).length;
  const inRangeCount = valid.filter((v) => v >= low && v <= high).length;
  const highOnly = valid.filter((v) => v > high && v <= 250).length;
  const veryHigh = valid.filter((v) => v > 250).length;

  return {
    count,
    avg,
    min: Math.min(...valid),
    max: Math.max(...valid),
    sd,
    cv: avg > 0 ? (sd / avg) * 100 : 0,
    inRange: pct(inRangeCount),
    low: pct(lowOnly),
    veryLow: pct(veryLow),
    high: pct(highOnly),
    veryHigh: pct(veryHigh),
    gmi: 3.31 + 0.02392 * avg,
    eA1c: (avg + 46.7) / 28.7,
  };
}

export interface BolusResult {
  carbUnits: number;
  correctionUnits: number;
  iobUnits: number;
  total: number;
  valid: boolean;
  warning?: string;
}

export function bolusSuggestion(input: {
  carbs: number;
  icr: number;
  isf: number;
  currentGlucose: number;
  targetGlucose: number;
  iob?: number;
}): BolusResult {
  const iob = Math.max(0, input.iob ?? 0);
  if (!input.icr || input.icr <= 0) {
    return { carbUnits: 0, correctionUnits: 0, iobUnits: iob, total: 0, valid: false, warning: 'Informe a relação carbo/insulina nas configurações.' };
  }
  const carbUnits = Math.max(0, input.carbs) / input.icr;
  const correction = input.isf > 0 && input.currentGlucose > 0 ? (input.currentGlucose - input.targetGlucose) / input.isf : 0;
  const raw = Math.max(0, carbUnits + correction - iob);
  return {
    carbUnits,
    correctionUnits: correction,
    iobUnits: iob,
    total: Math.round(raw * 2) / 2,
    valid: true,
    warning: input.currentGlucose > 0 && input.currentGlucose < 70 ? 'Glicemia abaixo de 70 mg/dL: trate a hipoglicemia antes de aplicar insulina.' : undefined,
  };
}

export function streakDays(datesWithLogs: string[], today: string): number {
  if (!datesWithLogs.length) return 0;
  const set = new Set(datesWithLogs);
  let cursor = today;
  let count = 0;
  // Se hoje ainda não tem registro, a sequência pode começar ontem.
  if (!set.has(cursor)) cursor = addDaysISO(cursor, -1);
  while (set.has(cursor)) {
    count += 1;
    cursor = addDaysISO(cursor, -1);
  }
  return count;
}

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function formatKcal(value: number): string {
  return `${Math.round(value).toLocaleString('pt-BR')} kcal`;
}

export function formatMl(value: number): string {
  if (value >= 1000) return `${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L`;
  return `${Math.round(value)} ml`;
}

export function formatG(value: number, decimals = 0): string {
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: decimals })} g`;
}

export function formatDecimal(value: number, digits = 1): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
