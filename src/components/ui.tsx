import { useEffect, useId, useRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from './Icon';

/* ------------------------------- Button ------------------------------- */

type ButtonVariant = 'primary' | 'soft' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
  icon?: IconName;
  iconRight?: IconName;
}

export function Button({ variant = 'soft', size = 'md', block, icon, iconRight, className = '', children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={`btn btn--${variant}${size === 'sm' ? ' btn--sm' : ''}${size === 'lg' ? ' btn--lg' : ''}${block ? ' btn--block' : ''} ${className}`}
      {...rest}
    >
      {icon ? <Icon name={icon} /> : null}
      {children}
      {iconRight ? <Icon name={iconRight} /> : null}
    </button>
  );
}

/* -------------------------------- Card -------------------------------- */

export function Card({ children, className = '', glow, flat, style }: { children: ReactNode; className?: string; glow?: boolean; flat?: boolean; style?: CSSProperties }) {
  return (
    <section className={`card${glow ? ' card--glow' : ''}${flat ? ' card--flat' : ''} ${className}`} style={style}>
      {children}
    </section>
  );
}

export function CardHead({
  title,
  sub,
  icon,
  action,
}: {
  title: string;
  sub?: string;
  icon?: IconName;
  action?: ReactNode;
}) {
  return (
    <div className="card-head">
      <div>
        <h2 className="card-title">
          {icon ? <Icon name={icon} /> : null}
          {title}
        </h2>
        {sub ? <p className="card-sub">{sub}</p> : null}
      </div>
      {action}
    </div>
  );
}

/* -------------------------------- chips ------------------------------- */

export function Chip({ children, tone, icon }: { children: ReactNode; tone?: 'mint' | 'cyan' | 'violet' | 'amber' | 'rose'; icon?: IconName }) {
  return (
    <span className={`chip${tone ? ` chip--${tone}` : ''}`}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </span>
  );
}

export function Badge({ children, tone = 'mint' }: { children: ReactNode; tone?: 'mint' | 'amber' | 'rose' | 'cyan' }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

/* -------------------------------- field ------------------------------- */

export function Field({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <span className="field__hint">{hint}</span> : null}
    </div>
  );
}

/* ------------------------------ segmented ----------------------------- */

interface Option<T extends string> {
  value: T;
  label: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="segmented" role="tablist" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          className={`segmented__btn${option.value === value ? ' is-active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------- stat tile ---------------------------- */

export function Stat({ label, value, unit, hint }: { label: string; value: ReactNode; unit?: string; hint?: string }) {
  return (
    <div className="stat">
      <div className="stat__label">{label}</div>
      <div className="stat__value">
        {value}
        {unit ? <small>{unit}</small> : null}
      </div>
      {hint ? <div className="stat__hint">{hint}</div> : null}
    </div>
  );
}

/* ------------------------------ empty state --------------------------- */

export function EmptyState({ icon = 'sparkles', title, hint, action }: { icon?: IconName; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty__icon">
        <Icon name={icon} />
      </div>
      <b>{title}</b>
      {hint ? <span>{hint}</span> : null}
      {action}
    </div>
  );
}

/* ------------------------------ sheet/modal --------------------------- */

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: IconName;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => closeRef.current?.focus(), 60);

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
      if (event.key !== 'Tab' || !bodyRef.current) return;
      const focusable = bodyRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="sheet-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={`sheet${wide ? ' sheet--wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="sheet__grab" aria-hidden="true" />
        <header className="sheet__head">
          {icon ? (
            <div className="sheet__icon">
              <Icon name={icon} />
            </div>
          ) : null}
          <div style={{ minWidth: 0 }}>
            <h2 className="sheet__title" id={titleId}>
              {title}
            </h2>
            {subtitle ? <p className="sheet__sub">{subtitle}</p> : null}
          </div>
          <button ref={closeRef} type="button" className="sheet__close" onClick={onClose} aria-label="Fechar">
            <Icon name="x" />
          </button>
        </header>
        <div className="sheet__body" ref={bodyRef}>
          {children}
        </div>
        {footer ? <footer className="sheet__foot">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------ progress ring ------------------------- */

export function ProgressRing({
  value,
  max,
  size = 104,
  stroke = 9,
  color = 'var(--mint)',
  color2,
  label,
  children,
  trackColor,
  ariaLabel,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  color?: string;
  color2?: string;
  label?: string;
  children?: ReactNode;
  trackColor?: string;
  ariaLabel?: string;
}) {
  const gradientId = useId().replace(/:/g, '');
  const pct = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);

  return (
    <div
      className="ring"
      style={{ width: size, height: size }}
      role="img"
      aria-label={ariaLabel ?? `${Math.round(pct * 100)}%`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {color2 ? (
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={color} />
              <stop offset="100%" stopColor={color2} />
            </linearGradient>
          </defs>
        ) : null}
        <circle className="ring__track" cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} style={trackColor ? { stroke: trackColor } : undefined} />
        <circle
          className="ring__fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          stroke={color2 ? `url(#${gradientId})` : color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="ring__content">
        {children}
        {label ? <span className="ring__label">{label}</span> : null}
      </div>
    </div>
  );
}

/* ------------------------------- macro bar ---------------------------- */

export function MacroBar({
  label,
  value,
  goal,
  tone,
  unit = 'g',
}: {
  label: string;
  value: number;
  goal: number;
  tone: 'carbs' | 'protein' | 'fat' | 'fiber';
  unit?: string;
}) {
  const pct = Math.max(0, Math.min(100, goal > 0 ? (value / goal) * 100 : 0));
  return (
    <div className="macro-item">
      <div className="macro-item__head">
        <span>{label}</span>
        <span>
          <b>
            {Math.round(value)}
            {unit}
          </b>{' '}
          / {Math.round(goal)}
          {unit}
        </span>
      </div>
      <div className={`macro-track macro-track--${tone}`}>
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ------------------------------- screen head -------------------------- */

export function ScreenHead({ eyebrow, title, subtitle, actions }: { eyebrow?: string; title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div className="page-head__text">
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {subtitle ? <p className="page-sub">{subtitle}</p> : null}
      </div>
      {actions ? <div className="row row--wrap">{actions}</div> : null}
    </div>
  );
}

/* --------------------------------- logo ------------------------------- */

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="logo-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2fe0b0" />
          <stop offset="1" stopColor="#4cc9f0" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="19" fill="none" stroke="url(#logo-ring)" strokeWidth="5" strokeDasharray="92 28" strokeLinecap="round" transform="rotate(-45 32 32)" />
      <path d="M21 34h6l3.4-7 4.2 13 3-6h5" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
