import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { db } from '../db/db';
import { DEFAULT_PROFILE, type Food, type Goals, type LogEntry, type MealItem, type MealType, type Profile, type GlucoseContext } from '../db/types';
import { addDays, makeId, nowISO, todayISO } from '../domain/dates';
import { buildDemoData } from '../domain/demo';
import { calcGoals } from '../domain/health';

export interface AppActions {
  saveProfile: (patch: Partial<Profile>) => Promise<void>;
  addMeal: (mealType: MealType, items: MealItem[], note?: string) => Promise<void>;
  addWater: (ml: number, label?: string) => Promise<void>;
  addGlucose: (mgdl: number, context: GlucoseContext, note?: string) => Promise<void>;
  addWeight: (kg: number, bodyFat?: number) => Promise<void>;
  addInsulin: (units: number, insulinType: 'rapida' | 'basal') => Promise<void>;
  deleteLog: (id: string) => Promise<void>;
  addCustomFood: (food: Omit<Food, 'id'>) => Promise<void>;
  toggleFavorite: (food: Food) => Promise<void>;
  loadDemo: () => Promise<void>;
  clearAll: () => Promise<void>;
  importBackup: (backup: unknown) => Promise<{ logs: number; foods: number }>;
  refresh: () => Promise<void>;
  setTheme: (theme: Profile['theme']) => Promise<void>;
}

interface AppContextValue {
  ready: boolean;
  error: string | null;
  profile: Profile | null;
  logs: LogEntry[];
  foods: Food[];
  goals: Goals;
  today: string;
  storageMode: 'indexeddb' | 'memory';
  actions: AppActions;
}

const AppContext = createContext<AppContextValue | null>(null);

const loadAll = async () => {
  await db.open();
  const today = todayISO();
  const [profile, logs, foods] = await Promise.all([
    db.getProfile(),
    db.listLogs({ since: addDays(today, -400) }),
    db.listFoods(),
  ]);
  return { profile, logs, foods };
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [foods, setFoods] = useState<Food[]>([]);
  const [today, setToday] = useState(todayISO());
  const mounted = useRef(true);
  const profileRef = useRef<Profile | null>(null);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    mounted.current = true;
    (async () => {
      try {
        const data = await loadAll();
        if (!mounted.current) return;
        setProfile(data.profile);
        setLogs(data.logs);
        setFoods(data.foods);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao carregar os dados');
      } finally {
        if (mounted.current) setReady(true);
      }
    })();
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const check = () => setToday(todayISO());
    const interval = window.setInterval(check, 60_000);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  const goals = useMemo(() => calcGoals(profile ?? DEFAULT_PROFILE), [profile]);

  const refresh = useCallback(async () => {
    const data = await loadAll();
    setProfile(data.profile);
    setLogs(data.logs);
    setFoods(data.foods);
  }, []);

  const saveProfile = useCallback(async (patch: Partial<Profile>) => {
    const base = profileRef.current ?? { ...DEFAULT_PROFILE, createdAt: nowISO(), onboarded: true };
    const next: Profile = { ...base, ...patch, id: 'me', updatedAt: nowISO() };
    profileRef.current = next;
    setProfile(next);
    await db.saveProfile(next);
  }, []);

  const setTheme = useCallback(
    async (theme: Profile['theme']) => {
      await saveProfile({ theme });
    },
    [saveProfile],
  );

  const persistLog = useCallback(async (log: LogEntry, extra?: (entry: LogEntry) => void) => {
    await db.putLog(log);
    setLogs((prev) => [...prev, log].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    if (extra) extra(log);
  }, []);

  const addMeal = useCallback(
    async (mealType: MealType, items: MealItem[], note?: string) => {
      const log: LogEntry = {
        id: makeId(),
        kind: 'meal',
        date: todayISO(),
        createdAt: nowISO(),
        mealType,
        items,
        note,
      };
      await persistLog(log);
    },
    [persistLog],
  );

  const addWater = useCallback(
    async (ml: number, label?: string) => {
      if (!Number.isFinite(ml) || ml <= 0) return;
      const log: LogEntry = { id: makeId(), kind: 'water', date: todayISO(), createdAt: nowISO(), ml: Math.round(ml), label };
      await persistLog(log);
    },
    [persistLog],
  );

  const addGlucose = useCallback(
    async (mgdl: number, context: GlucoseContext, note?: string) => {
      if (!Number.isFinite(mgdl) || mgdl <= 0) return;
      const log: LogEntry = { id: makeId(), kind: 'glucose', date: todayISO(), createdAt: nowISO(), mgdl: Math.round(mgdl), context, note };
      await persistLog(log);
    },
    [persistLog],
  );

  const addWeight = useCallback(
    async (kg: number, bodyFat?: number) => {
      if (!Number.isFinite(kg) || kg <= 0) return;
      const log: LogEntry = { id: makeId(), kind: 'weight', date: todayISO(), createdAt: nowISO(), kg: Math.round(kg * 10) / 10, bodyFat };
      await db.putLog(log);
      setLogs((prev) => [...prev, log].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
      await saveProfile({ weightKg: Math.round(kg * 10) / 10 });
    },
    [saveProfile],
  );

  const addInsulin = useCallback(
    async (units: number, insulinType: 'rapida' | 'basal') => {
      if (!Number.isFinite(units) || units <= 0) return;
      const log: LogEntry = { id: makeId(), kind: 'insulin', date: todayISO(), createdAt: nowISO(), units: Math.round(units * 2) / 2, insulinType };
      await persistLog(log);
    },
    [persistLog],
  );

  const deleteLog = useCallback(async (id: string) => {
    await db.deleteLog(id);
    setLogs((prev) => prev.filter((log) => log.id !== id));
  }, []);

  const addCustomFood = useCallback(async (food: Omit<Food, 'id'>) => {
    const full: Food = { ...food, id: `custom-${makeId()}`, custom: true };
    await db.putFood(full);
    setFoods((prev) => [full, ...prev]);
  }, []);

  const toggleFavorite = useCallback(async (food: Food) => {
    const updated = { ...food, favorite: !food.favorite };
    await db.putFood(updated);
    setFoods((prev) => prev.map((item) => (item.id === food.id ? updated : item)));
  }, []);

  const loadDemo = useCallback(async () => {
    const base = profileRef.current ?? { ...DEFAULT_PROFILE, createdAt: nowISO() };
    const demo = buildDemoData(base, 21);
    const nextProfile: Profile = { ...base, ...demo.profilePatch, id: 'me', updatedAt: nowISO() };
    await db.clearLogs();
    await db.putLogs(demo.logs);
    await db.saveProfile(nextProfile);
    profileRef.current = nextProfile;
    setProfile(nextProfile);
    setLogs(demo.logs);
  }, []);

  const clearAll = useCallback(async () => {
    await db.clearAll();
    profileRef.current = null;
    setProfile(null);
    setLogs([]);
  }, []);

  const importBackup = useCallback(async (backup: unknown) => {
    const data = backup as { app?: string; logs?: unknown[]; foods?: unknown[]; profile?: Profile };
    if (!data || data.app !== 'vitalis') throw new Error('Arquivo de backup inválido: identidade do app não confere.');
    if (data.profile && (!data.profile.id || typeof data.profile.weightKg !== 'number')) {
      throw new Error('Perfil inválido no backup.');
    }
    await db.importBackup({
      app: 'vitalis',
      version: 1,
      exportedAt: new Date().toISOString(),
      profile: data.profile ?? null,
      logs: (data.logs ?? []) as LogEntry[],
      foods: (data.foods ?? []) as Food[],
    });
    const dataAfter = await loadAll();
    profileRef.current = dataAfter.profile;
    setProfile(dataAfter.profile);
    setLogs(dataAfter.logs);
    setFoods(dataAfter.foods);
    return { logs: dataAfter.logs.length, foods: dataAfter.foods.length };
  }, []);

  useEffect(() => {
    if (profile?.onboarded) void db.requestPersistence();
  }, [profile?.onboarded]);

  useEffect(() => {
    if (!profile) return;
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => {
      const resolved = profile.theme === 'auto' ? (media.matches ? 'light' : 'dark') : profile.theme;
      document.documentElement.dataset.theme = resolved;
      document.documentElement.style.colorScheme = resolved;
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', resolved === 'light' ? '#f4f6fb' : '#070b16');
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [profile]);

  const value = useMemo<AppContextValue>(
    () => ({
      ready,
      error,
      profile,
      logs,
      foods,
      goals,
      today,
      storageMode: db.fallback ? 'memory' : 'indexeddb',
      actions: {
        saveProfile,
        addMeal,
        addWater,
        addGlucose,
        addWeight,
        addInsulin,
        deleteLog,
        addCustomFood,
        toggleFavorite,
        loadDemo,
        clearAll,
        importBackup,
        refresh,
        setTheme,
      },
    }),
    [ready, error, profile, logs, foods, goals, today, saveProfile, addMeal, addWater, addGlucose, addWeight, addInsulin, deleteLog, addCustomFood, toggleFavorite, loadDemo, clearAll, importBackup, refresh, setTheme],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp precisa estar dentro de AppProvider');
  return ctx;
}
