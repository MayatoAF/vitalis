const DTF = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
const DTL = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
const DTIME = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

export const pad2 = (n: number): string => String(n).padStart(2, '0');

export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

export const todayISO = (): string => toISODate(new Date());

export function addDays(iso: string, days: number): string {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function daysBetween(fromISO: string, toISOValue: string): number {
  const a = parseISODate(fromISO).getTime();
  const b = parseISODate(toISOValue).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function lastNDays(count: number, endISO = todayISO()): string[] {
  return Array.from({ length: count }, (_, i) => addDays(endISO, i - (count - 1)));
}

export function startOfWeek(iso: string): string {
  const date = parseISODate(iso);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return toISODate(date);
}

export function formatDateLong(iso: string): string {
  const text = DTL.format(parseISODate(iso));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatDateShort(iso: string): string {
  return DTF.format(parseISODate(iso)).replace('.', '');
}

export function weekdayShort(iso: string): string {
  return DTF.format(parseISODate(iso)).split(',')[0].replace('.', '');
}

export function formatDayMonth(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export function timeLabel(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  return Number.isNaN(date.getTime()) ? '--:--' : DTIME.format(date);
}

export function ageFromBirth(birthISO: string): number | null {
  if (!birthISO) return null;
  const birth = parseISODate(birthISO);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

export function isToday(iso: string): boolean {
  return iso === todayISO();
}

export function relativeDayLabel(iso: string): string {
  const diff = daysBetween(iso, todayISO());
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  if (diff > 1 && diff < 7) return formatDateShort(iso);
  return formatDateShort(iso);
}

export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Boa madrugada';
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
