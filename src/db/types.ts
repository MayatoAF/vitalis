export type Sex = 'f' | 'm' | 'o';
export type ActivityLevel = 'sedentario' | 'leve' | 'moderado' | 'intenso' | 'atleta';
export type GoalKind = 'perder' | 'manter' | 'ganhar';
export type MealType = 'cafe' | 'almoco' | 'jantar' | 'lanche' | 'ceia';
export type GlucoseContext = 'jejum' | 'pre' | 'pos' | 'dormir' | 'aleatorio';
export type DiabetesType = 'tipo1' | 'tipo2' | 'prediabetes' | 'gestacional' | 'nenhum';
export type ThemePref = 'dark' | 'light' | 'auto';
export type LogKind = 'meal' | 'water' | 'glucose' | 'weight' | 'insulin';

export interface Profile {
  id: 'me';
  name: string;
  sex: Sex;
  birthDate: string; // YYYY-MM-DD
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goal: GoalKind;
  rateKgWeek: number;
  diabetes: DiabetesType;
  /** Metas manuais (0 = automático) */
  calorieGoal: number;
  waterGoalMl: number;
  carbGoalG: number;
  proteinGoalG: number;
  fatGoalG: number;
  fiberGoalG: number;
  glucoseLow: number;
  glucoseHigh: number;
  /** Relação carbo/insulina: 1 unidade cobre N g de carboidrato */
  icr: number;
  /** Fator de sensibilidade: 1 unidade baixa N mg/dL */
  isf: number;
  /** Glicemia alvo para correção */
  targetGlucose: number;
  theme: ThemePref;
  onboarded: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Nutrition100 {
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
  fiber: number;
}

export interface Portion {
  label: string;
  grams: number;
}

export interface Food {
  id: string;
  name: string;
  category: string;
  per100: Nutrition100;
  portions: Portion[];
  custom?: boolean;
  favorite?: boolean;
}

export interface MealItem {
  name: string;
  grams: number;
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
  fiber: number;
}

interface LogBase {
  id: string;
  kind: LogKind;
  date: string; // YYYY-MM-DD (fuso local)
  createdAt: string; // ISO
  note?: string;
}

export interface MealLog extends LogBase {
  kind: 'meal';
  mealType: MealType;
  items: MealItem[];
}

export interface WaterLog extends LogBase {
  kind: 'water';
  ml: number;
  label?: string;
}

export interface GlucoseLog extends LogBase {
  kind: 'glucose';
  mgdl: number;
  context: GlucoseContext;
}

export interface WeightLog extends LogBase {
  kind: 'weight';
  kg: number;
  bodyFat?: number;
}

export interface InsulinLog extends LogBase {
  kind: 'insulin';
  units: number;
  insulinType: 'rapida' | 'basal';
}

export type LogEntry = MealLog | WaterLog | GlucoseLog | WeightLog | InsulinLog;

export interface Totals {
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
  fiber: number;
}

export interface Goals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  waterMl: number;
  bmr: number;
  tdee: number;
}

export interface Backup {
  app: 'vitalis';
  version: number;
  exportedAt: string;
  profile: Profile | null;
  logs: LogEntry[];
  foods: Food[];
}

export const MEAL_TYPES: { id: MealType; label: string; icon: string; hint: string }[] = [
  { id: 'cafe', label: 'Café da manhã', icon: 'sunrise', hint: 'Comece o dia com energia' },
  { id: 'almoco', label: 'Almoço', icon: 'sun', hint: 'Prato principal' },
  { id: 'jantar', label: 'Jantar', icon: 'moon', hint: 'Feche o dia leve' },
  { id: 'lanche', label: 'Lanches', icon: 'apple', hint: 'Ao longo do dia' },
  { id: 'ceia', label: 'Ceia', icon: 'night', hint: 'Antes de dormir' },
];

export const GLUCOSE_CONTEXTS: { id: GlucoseContext; label: string }[] = [
  { id: 'jejum', label: 'Jejum' },
  { id: 'pre', label: 'Antes da refeição' },
  { id: 'pos', label: 'Depois da refeição' },
  { id: 'dormir', label: 'Antes de dormir' },
  { id: 'aleatorio', label: 'Aleatório' },
];

export const ACTIVITY_LABELS: Record<ActivityLevel, { label: string; hint: string; factor: number }> = {
  sedentario: { label: 'Sedentário', hint: 'Pouco ou nenhum exercício', factor: 1.2 },
  leve: { label: 'Leve', hint: '1–3× por semana', factor: 1.375 },
  moderado: { label: 'Moderado', hint: '3–5× por semana', factor: 1.55 },
  intenso: { label: 'Intenso', hint: '6–7× por semana', factor: 1.725 },
  atleta: { label: 'Atleta', hint: 'Treino 2× ao dia', factor: 1.9 },
};

export const DEFAULT_PROFILE: Profile = {
  id: 'me',
  name: '',
  sex: 'f',
  birthDate: '',
  heightCm: 168,
  weightKg: 68,
  activity: 'leve',
  goal: 'manter',
  rateKgWeek: 0.4,
  diabetes: 'nenhum',
  calorieGoal: 0,
  waterGoalMl: 0,
  carbGoalG: 0,
  proteinGoalG: 0,
  fatGoalG: 0,
  fiberGoalG: 25,
  glucoseLow: 70,
  glucoseHigh: 180,
  icr: 10,
  isf: 50,
  targetGlucose: 110,
  theme: 'dark',
  onboarded: false,
  createdAt: '',
  updatedAt: '',
};
