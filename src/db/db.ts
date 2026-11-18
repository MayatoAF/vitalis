import { SEED_FOODS } from './foods';
import type { Backup, Food, LogEntry, Profile } from './types';

const DB_NAME = 'vitalis-db';
const DB_VERSION = 1;
const S_PROFILE = 'profile';
const S_LOGS = 'logs';
const S_FOODS = 'foods';
const S_META = 'meta';

type MetaValue = string | number | boolean | null;

const promisify = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Falha no IndexedDB'));
  });

const txDone = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Transação falhou'));
    tx.onabort = () => reject(tx.error ?? new Error('Transação abortada'));
  });

/**
 * Camada de persistência: IndexedDB com fallback em memória
 * (modo privado / navegadores sem suporte), mantendo a API idêntica.
 */
class VitalisDatabase {
  private db: IDBDatabase | null = null;
  private opening: Promise<void> | null = null;
  private memory = {
    profile: new Map<string, Profile>(),
    logs: new Map<string, LogEntry>(),
    foods: new Map<string, Food>(),
    meta: new Map<string, MetaValue>(),
  };
  fallback = false;
  lastError: string | null = null;

  get isReady(): boolean {
    return this.db !== null || this.fallback;
  }

  open(): Promise<void> {
    if (this.opening) return this.opening;
    this.opening = new Promise<void>((resolve) => {
      if (!('indexedDB' in globalThis)) {
        this.enableFallback('IndexedDB indisponível neste navegador');
        resolve();
        return;
      }
      let settled = false;
      const finish = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(S_PROFILE)) db.createObjectStore(S_PROFILE, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(S_LOGS)) {
          const logs = db.createObjectStore(S_LOGS, { keyPath: 'id' });
          logs.createIndex('date', 'date', { unique: false });
          logs.createIndex('kind', 'kind', { unique: false });
        }
        if (!db.objectStoreNames.contains(S_FOODS)) {
          const foods = db.createObjectStore(S_FOODS, { keyPath: 'id' });
          foods.createIndex('name', 'name', { unique: false });
          for (const food of SEED_FOODS) foods.put(food);
        }
        if (!db.objectStoreNames.contains(S_META)) db.createObjectStore(S_META);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.db.onversionchange = () => {
          this.db?.close();
          this.db = null;
        };
        finish();
      };

      request.onerror = () => {
        this.enableFallback(request.error?.message ?? 'Não foi possível abrir o banco');
        finish();
      };

      request.onblocked = () => {
        this.lastError = 'Atualização do banco bloqueada por outra aba aberta';
      };

      setTimeout(() => {
        if (!this.db && !this.fallback) {
          this.lastError = 'O banco demorou para responder; usando memória temporária';
          this.enableFallback(this.lastError);
          finish();
        }
      }, 4000);
    });
    return this.opening;
  }

  private enableFallback(reason: string) {
    if (this.fallback) return;
    this.fallback = true;
    this.lastError = reason;
    for (const food of SEED_FOODS) this.memory.foods.set(food.id, food);
    // eslint-disable-next-line no-console
    console.warn('[Vitalis] IndexedDB indisponível, usando memória:', reason);
  }

  private store(name: string, mode: IDBTransactionMode): IDBObjectStore {
    if (!this.db) throw new Error('Banco não inicializado');
    return this.db.transaction(name, mode).objectStore(name);
  }

  async getProfile(): Promise<Profile | null> {
    await this.open();
    if (!this.db) return this.memory.profile.get('me') ?? null;
    const p = await promisify<Profile | undefined>(this.store(S_PROFILE, 'readonly').get('me'));
    return p ?? null;
  }

  async saveProfile(profile: Profile): Promise<void> {
    await this.open();
    if (!this.db) {
      this.memory.profile.set('me', profile);
      return;
    }
    const tx = this.db.transaction(S_PROFILE, 'readwrite');
    tx.objectStore(S_PROFILE).put(profile);
    await txDone(tx);
  }

  async listLogs(options: { since?: string; until?: string } = {}): Promise<LogEntry[]> {
    await this.open();
    const result: LogEntry[] = [];

    if (!this.db) {
      for (const log of this.memory.logs.values()) result.push(log);
    } else {
      const store = this.store(S_LOGS, 'readonly');
      const index = store.index('date');
      let range: IDBKeyRange | null = null;
      if (options.since && options.until) range = IDBKeyRange.bound(options.since, options.until);
      else if (options.since) range = IDBKeyRange.lowerBound(options.since);
      else if (options.until) range = IDBKeyRange.upperBound(options.until);
      result.push(...(await promisify<LogEntry[]>(index.getAll(range))));
    }

    return result
      .filter((log) => (!options.since || log.date >= options.since) && (!options.until || log.date <= options.until))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async putLog(log: LogEntry): Promise<void> {
    await this.open();
    if (!this.db) {
      this.memory.logs.set(log.id, log);
      return;
    }
    const tx = this.db.transaction(S_LOGS, 'readwrite');
    tx.objectStore(S_LOGS).put(log);
    await txDone(tx);
  }

  async putLogs(logs: LogEntry[]): Promise<void> {
    if (!logs.length) return;
    await this.open();
    if (!this.db) {
      for (const log of logs) this.memory.logs.set(log.id, log);
      return;
    }
    const tx = this.db.transaction(S_LOGS, 'readwrite');
    const store = tx.objectStore(S_LOGS);
    for (const log of logs) store.put(log);
    await txDone(tx);
  }

  async deleteLog(id: string): Promise<void> {
    await this.open();
    if (!this.db) {
      this.memory.logs.delete(id);
      return;
    }
    const tx = this.db.transaction(S_LOGS, 'readwrite');
    tx.objectStore(S_LOGS).delete(id);
    await txDone(tx);
  }

  async clearLogs(): Promise<void> {
    await this.open();
    if (!this.db) {
      this.memory.logs.clear();
      return;
    }
    const tx = this.db.transaction(S_LOGS, 'readwrite');
    tx.objectStore(S_LOGS).clear();
    await txDone(tx);
  }

  async listFoods(): Promise<Food[]> {
    await this.open();
    let foods: Food[];
    if (!this.db) {
      foods = [...this.memory.foods.values()];
    } else {
      foods = await promisify<Food[]>(this.store(S_FOODS, 'readonly').getAll());
    }
    return foods.sort((a, b) => Number(b.favorite ?? false) - Number(a.favorite ?? false) || a.name.localeCompare(b.name, 'pt-BR'));
  }

  async putFood(food: Food): Promise<void> {
    await this.open();
    if (!this.db) {
      this.memory.foods.set(food.id, food);
      return;
    }
    const tx = this.db.transaction(S_FOODS, 'readwrite');
    tx.objectStore(S_FOODS).put(food);
    await txDone(tx);
  }

  async deleteFood(id: string): Promise<void> {
    await this.open();
    if (!this.db) {
      this.memory.foods.delete(id);
      return;
    }
    const tx = this.db.transaction(S_FOODS, 'readwrite');
    tx.objectStore(S_FOODS).delete(id);
    await txDone(tx);
  }

  async getMeta<T extends MetaValue>(key: string): Promise<T | null> {
    await this.open();
    if (!this.db) return (this.memory.meta.get(key) as T) ?? null;
    const value = await promisify<T | undefined>(this.store(S_META, 'readonly').get(key));
    return value ?? null;
  }

  async setMeta(key: string, value: MetaValue): Promise<void> {
    await this.open();
    if (!this.db) {
      this.memory.meta.set(key, value);
      return;
    }
    const tx = this.db.transaction(S_META, 'readwrite');
    tx.objectStore(S_META).put(value, key);
    await txDone(tx);
  }

  async exportAll(): Promise<Backup> {
    const [profile, logs, foods] = await Promise.all([this.getProfile(), this.listLogs(), this.listFoods()]);
    return {
      app: 'vitalis',
      version: DB_VERSION,
      exportedAt: new Date().toISOString(),
      profile,
      logs,
      foods: foods.filter((food) => food.custom),
    };
  }

  async importBackup(backup: Backup): Promise<void> {
    await this.open();
    if (backup.profile) await this.saveProfile(backup.profile);
    await this.putLogs(backup.logs ?? []);
    for (const food of backup.foods ?? []) await this.putFood({ ...food, custom: true });
  }

  async clearAll(): Promise<void> {
    await this.open();
    this.memory.profile.clear();
    this.memory.logs.clear();
    this.memory.meta.clear();
    if (!this.db) return;
    const tx = this.db.transaction([S_PROFILE, S_LOGS, S_META], 'readwrite');
    tx.objectStore(S_PROFILE).clear();
    tx.objectStore(S_LOGS).clear();
    tx.objectStore(S_META).clear();
    await txDone(tx);
  }

  async requestPersistence(): Promise<boolean> {
    try {
      if (navigator.storage?.persist) {
        if (await navigator.storage.persisted()) return true;
        return await navigator.storage.persist();
      }
    } catch {
      /* opcional */
    }
    return false;
  }
}

export const db = new VitalisDatabase();
