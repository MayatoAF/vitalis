import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AppProvider, useApp } from './state/AppContext';
import { ToastProvider } from './state/ToastContext';
import { useHashRoute } from './state/useHashRoute';
import { usePwa } from './pwa/pwa';
import { AppShell } from './components/AppShell';
import { Logo } from './components/ui';
import { Icon } from './components/Icon';
import { TodayScreen } from './screens/Today';
import { NutritionScreen } from './screens/Nutrition';
import { HydrationScreen } from './screens/Hydration';
import { CarbsScreen } from './screens/Carbs';
import { GlucoseScreen } from './screens/Glucose';
import { ProgressScreen } from './screens/Progress';
import { SettingsScreen } from './screens/Settings';
import { OnboardingScreen } from './screens/Onboarding';

function Splash() {
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            display: 'grid',
            placeItems: 'center',
            background: 'linear-gradient(140deg, rgba(47,224,176,.22), rgba(76,201,240,.14))',
            border: '1px solid rgba(47,224,176,.32)',
            boxShadow: '0 0 40px rgba(47,224,176,.18)',
          }}
        >
          <Logo size={32} />
        </div>
        <div>
          <div style={{ fontWeight: 700, letterSpacing: '-.02em' }}>Vitalis</div>
          <div className="tiny muted">Preparando seu espaço — tudo fica no seu dispositivo.</div>
        </div>
        <div className="skeleton" style={{ width: 140, height: 4, borderRadius: 99 }} />
      </div>
    </div>
  );
}

function StorageWarning() {
  const { storageMode } = useApp();
  const { offline } = usePwa();
  if (storageMode === 'indexeddb' && !offline) return null;
  if (storageMode === 'memory') {
    return (
      <div className="install-banner" style={{ borderColor: 'rgba(255,190,92,.4)', background: 'linear-gradient(110deg, rgba(255,190,92,.12), rgba(255,107,136,.06))' }}>
        <div className="install-banner__icon" style={{ background: 'rgba(255,190,92,.15)', color: 'var(--amber)' }}>
          <Icon name="alert" />
        </div>
        <div className="install-banner__text">
          <b>Modo temporário</b>
          <span>Este navegador bloqueou o banco local. Exporte um backup antes de fechar o app.</span>
        </div>
      </div>
    );
  }
  return null;
}

function Router() {
  const [route, navigate] = useHashRoute();
  const { ready, error, profile } = useApp();
  usePwa();

  if (!ready) return <Splash />;

  if (error) {
    return (
      <div className="onboarding" style={{ justifyContent: 'center' }}>
        <div className="onboarding__card" style={{ textAlign: 'center' }}>
          <h1 className="onboarding__title">Algo deu errado</h1>
          <p className="onboarding__sub">{error}</p>
          <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
            <Icon name="refresh" /> Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!profile?.onboarded) return <OnboardingScreen />;

  return (
    <AppShell route={route}>
      <StorageWarning />
      {route === 'today' ? <TodayScreen onNavigate={navigate} /> : null}
      {route === 'nutrition' ? <NutritionScreen /> : null}
      {route === 'hydration' ? <HydrationScreen /> : null}
      {route === 'carbs' ? <CarbsScreen /> : null}
      {route === 'glucose' ? <GlucoseScreen /> : null}
      {route === 'progress' ? <ProgressScreen /> : null}
      {route === 'settings' ? <SettingsScreen /> : null}
    </AppShell>
  );
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[Vitalis] erro de interface', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="onboarding" style={{ justifyContent: 'center' }}>
          <div className="onboarding__card">
            <h1 className="onboarding__title">Ops, algo falhou</h1>
            <p className="onboarding__sub">Seus dados continuam salvos. Recarregue para continuar.</p>
            <pre style={{ fontSize: '.68rem', color: 'var(--muted)', whiteSpace: 'pre-wrap', maxHeight: 140, overflow: 'auto' }}>{this.state.error.message}</pre>
            <button type="button" className="btn btn--primary" onClick={() => window.location.reload()} style={{ marginTop: 12 }}>
              <Icon name="refresh" /> Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AppProvider>
          <Router />
        </AppProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
