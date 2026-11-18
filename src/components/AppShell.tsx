import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useApp } from '../state/AppContext';
import type { Route } from '../state/useHashRoute';
import { navigate } from '../state/useHashRoute';
import { usePwa } from '../pwa/pwa';
import { greeting } from '../domain/dates';
import { Icon, type IconName } from './Icon';
import { Logo, Sheet } from './ui';

export interface NavItem {
  route: Route;
  label: string;
  icon: IconName;
  hint: string;
}

export const NAV_ITEMS: NavItem[] = [
  { route: 'today', label: 'Hoje', icon: 'home', hint: 'Seu dia em um olhar' },
  { route: 'nutrition', label: 'Nutrição', icon: 'utensils', hint: 'Calorias e macros' },
  { route: 'hydration', label: 'Hidratação', icon: 'droplet', hint: 'Controle de água' },
  { route: 'carbs', label: 'Carboidratos', icon: 'molecule', hint: 'Contagem e bolus' },
  { route: 'glucose', label: 'Glicemia', icon: 'activity', hint: 'Leituras e tempo na meta' },
  { route: 'progress', label: 'Progresso', icon: 'trend', hint: 'Peso, IMC e tendências' },
  { route: 'settings', label: 'Ajustes', icon: 'settings', hint: 'Perfil e metas' },
];

const PRIMARY: Route[] = ['today', 'nutrition', 'hydration'];
const HEALTH: Route[] = ['carbs', 'glucose', 'progress'];

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <a
      href={`#/${item.route}`}
      className={`nav-item${active ? ' is-active' : ''}`}
      aria-current={active ? 'page' : undefined}
      onClick={(event) => {
        event.preventDefault();
        navigate(item.route);
      }}
    >
      <Icon name={item.icon} />
      {item.label}
      {item.route === 'carbs' ? <span className="nav-item__badge">DM</span> : null}
    </a>
  );
}

function Sidebar({ route }: { route: Route }) {
  const { profile, storageMode } = useApp();
  const { canInstall, install } = usePwa();

  return (
    <aside className="sidebar" aria-label="Navegação principal">
      <div className="brand">
        <div className="brand__mark">
          <Logo size={22} />
        </div>
        <div>
          <div className="brand__name">Vitalis</div>
          <div className="brand__tag">cuidado diário</div>
        </div>
      </div>

      <nav className="nav">
        <span className="nav__label">Principal</span>
        {NAV_ITEMS.filter((item) => PRIMARY.includes(item.route)).map((item) => (
          <NavLink key={item.route} item={item} active={route === item.route} />
        ))}
        <span className="nav__label">Saúde</span>
        {NAV_ITEMS.filter((item) => HEALTH.includes(item.route)).map((item) => (
          <NavLink key={item.route} item={item} active={route === item.route} />
        ))}
      </nav>

      <div className="sidebar__foot">
        {canInstall ? (
          <button type="button" className="btn btn--soft btn--sm btn--block" onClick={() => void install()}>
            <Icon name="install" /> Instalar aplicativo
          </button>
        ) : null}
        <a
          href="#/settings"
          className={`nav-item${route === 'settings' ? ' is-active' : ''}`}
          onClick={(event) => {
            event.preventDefault();
            navigate('settings');
          }}
        >
          <Icon name="settings" />
          Ajustes
        </a>
        <div className="sidebar__storage">
          <Icon name="database" size={15} />
          <span>{storageMode === 'indexeddb' ? 'Dados salvos no dispositivo' : 'Modo temporário (memória)'}</span>
        </div>
        <div className="sidebar__storage" style={{ borderStyle: 'solid', borderColor: 'transparent' }}>
          <span className="pulse-dot" />
          <span>{profile?.name ? `Olá, ${profile.name.split(' ')[0]}` : 'Vitalis v1.0'}</span>
        </div>
      </div>
    </aside>
  );
}

function TopBar({ route }: { route: Route }) {
  const { profile } = useApp();
  const { offline, updateReady, applyUpdate } = usePwa();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 6);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const active = NAV_ITEMS.find((item) => item.route === route);
  const firstName = profile?.name?.trim().split(' ')[0] ?? '';
  const title = route === 'today' ? `${greeting()}${firstName ? `, ${firstName}` : ''}` : active?.label ?? 'Vitalis';
  const initials = (profile?.name?.trim() || 'V').slice(0, 1).toUpperCase();

  return (
    <header className={`topbar${scrolled ? ' is-scrolled' : ''}`}>
      <div className="topbar__left">
        <span className="topbar__greeting">{new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</span>
        <span className="topbar__title">{title}</span>
      </div>
      <div className="topbar__right">
        <span className="topbar__desktop-date">
          {new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date())}
        </span>
        {updateReady ? (
          <button type="button" className="status-chip status-chip--online" onClick={applyUpdate} title="Nova versão disponível">
            <Icon name="refresh" size={13} /> Atualizar
          </button>
        ) : null}
        {offline ? (
          <span className="status-chip status-chip--offline" title="Sem conexão — o app continua funcionando">
            <Icon name="offline" size={13} /> Offline
          </span>
        ) : (
          <span className="status-chip status-chip--online" title="Sincronizado com o dispositivo">
            <span className="pulse-dot" /> Salvo
          </span>
        )}
        <button type="button" className="avatar" onClick={() => navigate('settings')} aria-label="Abrir ajustes do perfil">
          {initials}
        </button>
      </div>
    </header>
  );
}

function BottomNav({ route, onMore }: { route: Route; onMore: () => void }) {
  const items: { route: Route; label: string; icon: IconName }[] = [
    { route: 'today', label: 'Hoje', icon: 'home' },
    { route: 'nutrition', label: 'Nutrição', icon: 'utensils' },
    { route: 'hydration', label: 'Água', icon: 'droplet' },
    { route: 'glucose', label: 'Glicemia', icon: 'activity' },
  ];
  const moreActive = !items.some((item) => item.route === route);

  return (
    <nav className="bottom-nav" aria-label="Navegação rápida">
      {items.map((item) => (
        <a
          key={item.route}
          href={`#/${item.route}`}
          className={`bottom-nav__item${route === item.route ? ' is-active' : ''}`}
          aria-current={route === item.route ? 'page' : undefined}
          onClick={(event) => {
            event.preventDefault();
            navigate(item.route);
          }}
        >
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </a>
      ))}
      <button type="button" className={`bottom-nav__item${moreActive ? ' is-active' : ''}`} onClick={onMore} aria-label="Mais seções">
        <Icon name="grid" />
        <span>Mais</span>
      </button>
    </nav>
  );
}

export function MoreSheet({ open, onClose, route }: { open: boolean; onClose: () => void; route: Route }) {
  const { canInstall, install } = usePwa();
  const items = NAV_ITEMS.filter((item) => ['carbs', 'progress', 'settings'].includes(item.route));

  return (
    <Sheet open={open} onClose={onClose} title="Mais seções" subtitle="Tudo o que você acompanha, em um só lugar" icon="grid">
      <div className="stack">
        {items.map((item) => (
          <button
            key={item.route}
            type="button"
            className="quick-action"
            onClick={() => {
              navigate(item.route);
              onClose();
            }}
            style={route === item.route ? { borderColor: 'rgba(47,224,176,.4)' } : undefined}
          >
            <span className="quick-action__icon">
              <Icon name={item.icon} />
            </span>
            <span className="quick-action__text">
              <b>{item.label}</b>
              <span>{item.hint}</span>
            </span>
            <Icon name="chevronRight" size={16} style={{ marginLeft: 'auto', color: 'var(--muted)' }} />
          </button>
        ))}
        {canInstall ? (
          <button type="button" className="quick-action" onClick={() => void install()}>
            <span className="quick-action__icon" style={{ background: 'var(--cyan-soft)', color: 'var(--cyan)' }}>
              <Icon name="install" />
            </span>
            <span className="quick-action__text">
              <b>Instalar aplicativo</b>
              <span>Funciona offline na tela inicial</span>
            </span>
          </button>
        ) : null}
      </div>
      <p className="footer-note">
        Vitalis não substitui orientação médica. Dados salvos apenas neste dispositivo.
      </p>
    </Sheet>
  );
}

export function AppShell({ route, children }: { route: Route; children: ReactNode }) {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className="app-shell">
      <Sidebar route={route} />
      <div className="app-main">
        <TopBar route={route} />
        <main className="page page-enter" key={route}>
          {children}
        </main>
      </div>
      <BottomNav route={route} onMore={() => setMoreOpen(true)} />
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} route={route} />
    </div>
  );
}
