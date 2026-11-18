import { SEED_FOODS } from '../db/foods';
import type { GlucoseContext, LogEntry, MealItem, MealType, Profile } from '../db/types';
import { addDays, makeId, todayISO } from './dates';

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type DraftLog = DistributiveOmit<LogEntry, 'id' | 'createdAt'> & { createdAt: string };

/** PRNG determinístico para que a demonstração seja sempre coerente. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const foodByName = (name: string) => SEED_FOODS.find((food) => food.name === name);

function item(name: string, grams: number): MealItem | null {
  const food = foodByName(name);
  if (!food) return null;
  const factor = grams / 100;
  const round1 = (value: number) => Math.round(value * 10) / 10;
  return {
    name: food.name,
    grams,
    kcal: Math.round(food.per100.kcal * factor),
    carbs: round1(food.per100.carbs * factor),
    protein: round1(food.per100.protein * factor),
    fat: round1(food.per100.fat * factor),
    fiber: round1(food.per100.fiber * factor),
  };
}

function items(spec: [string, number][]): MealItem[] {
  return spec.map(([name, grams]) => item(name, grams)).filter((value): value is MealItem => Boolean(value));
}

interface Plan {
  type: MealType;
  hour: number;
  minute: number;
  variants: [string, number][][];
}

const PLANS: Plan[] = [
  {
    type: 'cafe',
    hour: 7,
    minute: 20,
    variants: [
      [['Pão francês', 50], ['Manteiga', 10], ['Café com leite (sem açúcar)', 150], ['Banana prata', 90]],
      [['Tapioca (goma)', 80], ['Queijo minas frescal', 30], ['Ovo cozido', 50], ['Café sem açúcar', 50]],
      [['Pão de forma integral', 50], ['Requeijão cremoso', 20], ['Peito de peru fatiado', 40], ['Mamão papaia', 150]],
      [['Aveia em flocos', 40], ['Iogurte natural integral', 170], ['Morango', 100], ['Café sem açúcar', 50]],
    ],
  },
  {
    type: 'almoco',
    hour: 12,
    minute: 30,
    variants: [
      [['Arroz branco cozido', 150], ['Feijão carioca cozido', 90], ['Frango grelhado (peito)', 120], ['Salada de folhas com tomate', 120]],
      [['Arroz integral cozido', 130], ['Feijão preto cozido', 90], ['Carne bovina (patinho grelhado)', 100], ['Brócolis cozido', 90], ['Azeite de oliva', 8]],
      [['Macarrão cozido', 130], ['Frango grelhado (peito)', 110], ['Tomate', 100], ['Queijo muçarela', 20]],
      [['Batata-doce cozida', 150], ['Salmão grelhado', 130], ['Salada de folhas com tomate', 100]],
    ],
  },
  {
    type: 'lanche',
    hour: 16,
    minute: 10,
    variants: [
      [['Iogurte grego zero', 130], ['Granola tradicional', 20], ['Morango', 80]],
      [['Maçã com casca', 160], ['Castanha-do-pará', 10]],
      [['Pão de queijo', 40], ['Café sem açúcar', 50]],
      [['Whey protein (pó)', 30], ['Banana nanica', 100]],
    ],
  },
  {
    type: 'jantar',
    hour: 19,
    minute: 40,
    variants: [
      [['Tapioca (goma)', 90], ['Frango grelhado (peito)', 100], ['Salada de folhas com tomate', 100]],
      [['Omelete de 2 ovos', 120], ['Salada de folhas com tomate', 100], ['Pão de forma integral', 25]],
      [['Arroz branco cozido', 100], ['Feijão carioca cozido', 70], ['Tilápia grelhada', 120], ['Abobrinha cozida', 90]],
      [['Sopa de legumes com frango', 300], ['Pão francês', 25]],
    ],
  },
];

// 'Azeite de oliva' e 'Sopa de legumes com frango' não estão na base: são ignorados com segurança.
const WATER_SIZES = [200, 250, 300, 350, 400, 500];
const WATER_HOURS = [7, 9, 11, 13, 15, 17, 19, 21];

export interface DemoResult {
  logs: LogEntry[];
  profilePatch: Partial<Profile>;
}

export function buildDemoData(profile: Profile, days = 21): DemoResult {
  const rand = mulberry32(20261117);
  const logs: LogEntry[] = [];
  const today = todayISO();
  const now = new Date();
  const weightStart = profile.weightKg + 1.4;
  const diabetes = profile.diabetes;

  const push = (log: DraftLog) => {
    logs.push({ ...log, id: makeId(), createdAt: log.createdAt } as LogEntry);
  };

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = addDays(today, -offset);
    const isToday = date === today;
    const base = new Date(`${date}T00:00:00`);

    const at = (hour: number, minute: number): string | null => {
      const dt = new Date(base);
      dt.setHours(hour, minute, 0, 0);
      if (isToday && dt.getTime() > now.getTime()) return null;
      return dt.toISOString();
    };

    for (const plan of PLANS) {
      const createdAt = at(plan.hour, plan.minute);
      if (!createdAt) continue;
      const variant = plan.variants[Math.floor(rand() * plan.variants.length)];
      const mealItems = items(variant);
      if (!mealItems.length) continue;
      push({ kind: 'meal', date, mealType: plan.type, items: mealItems, createdAt, note: undefined });
    }

    const waterTarget = 7 + Math.floor(rand() * 2);
    for (let i = 0; i < waterTarget; i += 1) {
      const hour = WATER_HOURS[Math.min(i, WATER_HOURS.length - 1)];
      const createdAt = at(hour, Math.floor(rand() * 50));
      if (!createdAt) continue;
      const ml = WATER_SIZES[Math.floor(rand() * WATER_SIZES.length)];
      push({ kind: 'water', date, ml, label: ml >= 400 ? 'Garrafa' : 'Copo', createdAt });
    }

    const glucoseReadings: { hour: number; minute: number; context: GlucoseContext; value: number }[] = [
      { hour: 6, minute: 50, context: 'jejum', value: 88 + rand() * 24 },
      { hour: 11, minute: 45, context: 'pre', value: 92 + rand() * 26 },
      { hour: 14, minute: 20, context: 'pos', value: 128 + rand() * 58 },
      { hour: 21, minute: 30, context: 'dormir', value: 104 + rand() * 40 },
    ];
    if (diabetes === 'tipo1' || diabetes === 'tipo2') {
      glucoseReadings.push({ hour: 9, minute: 15, context: 'aleatorio', value: 120 + rand() * 80 });
    }
    for (const reading of glucoseReadings) {
      const createdAt = at(reading.hour, reading.minute);
      if (!createdAt) continue;
      const jitter = diabetes === 'nenhum' ? 0.85 : 1;
      push({ kind: 'glucose', date, mgdl: Math.round(reading.value * jitter), context: reading.context, createdAt });
    }

    if (offset % 2 === 0 || offset === days - 1) {
      const createdAt = at(7, 5);
      if (createdAt) {
        const kg = weightStart - ((days - 1 - offset) / (days - 1)) * 1.4 + (rand() - 0.5) * 0.25;
        push({ kind: 'weight', date, kg: Math.round(kg * 10) / 10, createdAt });
      }
    }

    if (diabetes === 'tipo1') {
      const createdAt = at(22, 0);
      if (createdAt) push({ kind: 'insulin', date, units: 12 + Math.floor(rand() * 4), insulinType: 'basal', createdAt });
    }
  }

  logs.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return {
    logs,
    profilePatch: {
      weightKg: Math.round((weightStart - 1.4) * 10) / 10,
      onboarded: true,
      name: profile.name || 'Marina',
      icr: profile.icr || 10,
      isf: profile.isf || 50,
      targetGlucose: profile.targetGlucose || 110,
      glucoseLow: profile.glucoseLow,
      glucoseHigh: profile.glucoseHigh,
      updatedAt: new Date().toISOString(),
    },
  };
}
