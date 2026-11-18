import { useCallback, useEffect, useSyncExternalStore } from 'react';

export interface PwaSnapshot {
  updateReady: boolean;
  offline: boolean;
  canInstall: boolean;
  installed: boolean;
  standalone: boolean;
  secureContext: boolean;
}

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isBrowser = typeof window !== 'undefined';
const listeners = new Set<() => void>();

let deferredPrompt: InstallPromptEvent | null = null;
let registration: ServiceWorkerRegistration | null = null;
let waitingWorker: ServiceWorker | null = null;
let reloading = false;
let initialized = false;

let snapshot: PwaSnapshot = {
  updateReady: false,
  offline: isBrowser ? !navigator.onLine : false,
  canInstall: false,
  installed: false,
  standalone: false,
  secureContext: isBrowser ? window.isSecureContext : false,
};

function emit(patch: Partial<PwaSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  for (const listener of listeners) listener();
}

function isStandalone(): boolean {
  if (!isBrowser) return false;
  const displayStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return displayStandalone || iosStandalone;
}

function markUpdateReady(worker: ServiceWorker) {
  waitingWorker = worker;
  if (snapshot.updateReady) return;
  emit({ updateReady: true });
}

async function register(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register(new URL('sw.js', document.baseURI).href, {
      scope: './',
      updateViaCache: 'none',
    });
    registration = reg;

    if (reg.waiting && navigator.serviceWorker.controller) markUpdateReady(reg.waiting);

    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) markUpdateReady(worker);
      });
    });

    // Verifica atualizações periodicamente e ao voltar para a aba.
    window.setInterval(() => void reg.update().catch(() => undefined), 30 * 60 * 1000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void reg.update().catch(() => undefined);
    });
  } catch (error) {
    // Falha de registro não impede o app de funcionar.
    console.info('[Vitalis] Service worker não registrado:', error);
  }
}

export function initPwa(): void {
  if (!isBrowser || initialized) return;
  initialized = true;

  emit({ standalone: isStandalone(), installed: isStandalone(), offline: !navigator.onLine });

  window.addEventListener('online', () => emit({ offline: false }));
  window.addEventListener('offline', () => emit({ offline: true }));

  // Instalação (Chrome/Edge/Android)
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as InstallPromptEvent;
    emit({ canInstall: true });
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    emit({ canInstall: false, installed: true, standalone: true });
  });

  const media = window.matchMedia('(display-mode: standalone)');
  media.addEventListener('change', () => emit({ standalone: isStandalone(), installed: isStandalone() }));

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!reloading) return;
      reloading = false;
      window.location.reload();
    });
  }

  if ((import.meta.env as ImportMetaEnv | undefined)?.PROD ?? true) {
    if (document.readyState === 'complete') void register();
    else window.addEventListener('load', () => void register(), { once: true });
  }
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable';
  try {
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      emit({ canInstall: false, installed: true });
    }
    deferredPrompt = null;
    emit({ canInstall: false });
    return choice.outcome;
  } catch {
    return 'unavailable';
  }
}

export function applyUpdate(): void {
  if (!waitingWorker) {
    window.location.reload();
    return;
  }
  reloading = true;
  waitingWorker.postMessage('SKIP_WAITING');
  waitingWorker = null;
  emit({ updateReady: false });
  // Rede de segurança caso controllerchange não dispare.
  window.setTimeout(() => {
    if (reloading) {
      reloading = false;
      window.location.reload();
    }
  }, 2500);
}

export function getPwaSnapshot(): PwaSnapshot {
  return snapshot;
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function usePwa() {
  const state = useSyncExternalStore(subscribe, getPwaSnapshot, getPwaSnapshot);

  useEffect(() => {
    initPwa();
  }, []);

  const install = useCallback(async () => promptInstall(), []);

  return { ...state, install, applyUpdate };
}
