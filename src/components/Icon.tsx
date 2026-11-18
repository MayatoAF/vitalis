import type { CSSProperties, ReactNode } from 'react';

const ICONS = {
  home: (
    <>
      <path d="M3 10.6 12 3l9 7.6V20a1.5 1.5 0 0 1-1.5 1.5H15v-7H9v7H4.5A1.5 1.5 0 0 1 3 20z" />
    </>
  ),
  utensils: (
    <>
      <path d="M6 3v7a2.5 2.5 0 0 0 5 0V3" />
      <path d="M8.5 10v11" />
      <path d="M17 3c1.8 2.6 2.7 5 2.7 7.2 0 1.6-1 2.8-2.7 2.8h-1V3z" />
      <path d="M17 13v8" />
    </>
  ),
  droplet: (
    <>
      <path d="M12 3.1c3.4 4.2 5.4 7 5.4 9.8a5.4 5.4 0 0 1-10.8 0c0-2.8 2-5.6 5.4-9.8z" />
    </>
  ),
  waves: (
    <>
      <path d="M2 7.5c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2 2.5-2 5-2" />
      <path d="M2 13c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2 2.5-2 5-2" />
      <path d="M2 18.5c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2 2.5-2 5-2" />
    </>
  ),
  activity: (
    <>
      <path d="M2 12h4l2.2-6.5L12.6 19l3-9.5 1.8 2.5H22" />
    </>
  ),
  molecule: (
    <>
      <circle cx="6" cy="6.5" r="2.6" />
      <circle cx="18" cy="6.5" r="2.6" />
      <circle cx="12" cy="18" r="2.6" />
      <path d="M8.3 7.4 15.7 7.4M7.4 8.7l3.4 6.9M16.6 8.7l-3.4 6.9" />
    </>
  ),
  trend: (
    <>
      <path d="M3 17.5 8.6 11l4.1 4L21 6.5" />
      <path d="M16 6.5h5v5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1" />
    </>
  ),
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  check: <path d="M20 6.5 9.2 17.3 4 12.1" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  trash: (
    <>
      <path d="M3.5 6.5h17M9 6.5V4h6v2.5M18.5 6.5 17.6 20H6.4L5.5 6.5" />
      <path d="M10 10.5v5.5M14 10.5v5.5" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12M7 10.5l5 5 5-5" />
      <path d="M4 20.5h16" />
    </>
  ),
  upload: (
    <>
      <path d="M12 21V9M7 13.5l5-5 5 5" />
      <path d="M4 4h16" />
    </>
  ),
  install: (
    <>
      <path d="M12 3v10M8 9l4 4 4-4" />
      <path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
    </>
  ),
  offline: (
    <>
      <path d="M2 2l20 20" />
      <path d="M8.6 16.4a5 5 0 0 1 6.8 0" />
      <path d="M5 12.8a10.4 10.4 0 0 1 4.7-2.6" />
      <path d="M2 8.7A15 15 0 0 1 6.6 6" />
      <path d="M12 20h.01" />
    </>
  ),
  refresh: (
    <>
      <path d="M21 12a9 9 0 1 1-2.6-6.4" />
      <path d="M21 3v6h-6" />
    </>
  ),
  chevronRight: <path d="M9 18l6-6-6-6" />,
  chevronLeft: <path d="M15 18l-6-6 6-6" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.6-3.6" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  sunrise: (
    <>
      <path d="M17 18a5 5 0 0 0-10 0" />
      <path d="M12 2v6M4.2 10.2l1.4 1.4M2 18h2M22 18h-2M18 10.2l-1.4 1.4M23 22H1M8 6l4-4 4 4" />
    </>
  ),
  apple: (
    <>
      <path d="M12 7.2C10.4 5.2 7.4 5.2 5.9 7.2 3.9 10.2 4.9 15.2 7.4 18.2c1.2 1.4 3 1.4 4.6.3 1.6 1.1 3.4 1.1 4.6-.3 2.5-3 3.5-8 1.5-11-1.5-2-4.5-2-6.1 0z" />
      <path d="M12 7V4.2M12 4.2c1-.9 2-1.2 3-1.2" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.2l3.4 2" />
    </>
  ),
  flame: (
    <path d="M12 22c3.9 0 6-2.6 6-6 0-3.8-2.7-6.1-4.2-9.2-.5 2.5-2 3.4-2 3.4S10.4 9 10.5 7C8.8 9.1 6 11.6 6 16c0 3.4 2.1 6 6 6z" />
  ),
  scale: (
    <>
      <path d="M4 20.5h16M6 20.5V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12.5" />
      <path d="M9.5 10.5h5M12 6V3.5" />
    </>
  ),
  syringe: (
    <>
      <path d="M18 2.5 21.5 6M17 7l-9.5 9.5L3 18l1.5-4.5L14 4l3 3z" />
      <path d="M14 4l6 6" />
      <path d="M6.5 13.5 10.5 17.5" />
    </>
  ),
  heart: (
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 0 0 0-7.8z" />
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-5M12 8h.01" />
    </>
  ),
  alert: (
    <>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4.5M12 17h.01" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3l1.9 4.8L18.7 9.7l-4.8 1.9L12 16.4l-1.9-4.8L5.3 9.7l4.8-1.9L12 3z" />
      <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4.5" width="18" height="17" rx="3" />
      <path d="M8 2.5v4M16 2.5v4M3 10h18" />
    </>
  ),
  arrowUp: <path d="M12 19V5M5 12l7-7 7 7" />,
  arrowDown: <path d="M12 5v14M19 12l-7 7-7-7" />,
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.2" />
    </>
  ),
  leaf: (
    <>
      <path d="M11 20A7 7 0 0 1 4 13c0-5 4-9 16-9 0 12-4 16-9 16z" />
      <path d="M4 21c2-5 5-8 10-10" />
    </>
  ),
  chart: (
    <>
      <path d="M3 21h18" />
      <path d="M7 21V11M12 21V4M17 21v-6" />
    </>
  ),
  pie: (
    <>
      <path d="M21.2 15.9A10 10 0 1 1 8 2.8" />
      <path d="M22 12A10 10 0 0 0 12 2v10z" />
    </>
  ),
  lock: (
    <>
      <rect x="3.5" y="10.5" width="17" height="10.5" rx="3" />
      <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
      <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  coffee: (
    <>
      <path d="M17 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M3 8h14v6a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8z" />
      <path d="M6 2.5v2M10 2.5v2M14 2.5v2" />
    </>
  ),
  bowl: (
    <>
      <path d="M3 11h18a9 9 0 0 1-18 0z" />
      <path d="M8 7c0-2 1-3 1-4M12 7c0-2 1-3 1-4M16 7c0-2 1-3 1-4" />
    </>
  ),
  egg: (
    <path d="M12 22a7 7 0 0 0 7-7c0-4-3-11-7-11S5 11 5 15a7 7 0 0 0 7 7z" />
  ),
  pizza: (
    <>
      <path d="M12 2.8c3.8 0 7.6 1.4 10 3.3L12 21.5 2 6.1C4.4 4.2 8.2 2.8 12 2.8z" />
      <path d="M11 9.5h.01M14.5 13h.01M9.5 14h.01" strokeWidth="2.6" />
    </>
  ),
  wifi: (
    <>
      <path d="M2 8.8A15 15 0 0 1 22 8.8" />
      <path d="M5 12.9a10 10 0 0 1 14 0" />
      <path d="M8.5 16.6a5 5 0 0 1 7 0" />
      <path d="M12 20h.01" />
    </>
  ),
  shield: (
    <>
      <path d="M12 2.5 20 5.5v5.8c0 4.9-3.3 8.5-8 10.2-4.7-1.7-8-5.3-8-10.2V5.5z" />
      <path d="M8.8 12l2.3 2.3 4.2-4.6" />
    </>
  ),
  sunMoon: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M4 12h16M13 5l7 7-7 7" />
    </>
  ),
  book: (
    <>
      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22.5z" />
      <path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
  style?: CSSProperties;
}

export function Icon({ name, size = 24, className, strokeWidth = 1.7, style }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[name]}
    </svg>
  );
}
