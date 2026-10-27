// Times shown in the event's local time (Thailand) · stored and sent as UTC
const TZ = 'Asia/Bangkok';
const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, ...opts });

export const formatDate = (iso: string) => fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
export const formatDay = (iso: string) => fmt({ weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso));
export const formatTime = (iso: string) => fmt({ hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
export const formatDateTime = (iso: string) => `${formatDay(iso)} · ${formatTime(iso)}`;
export const formatRange = (start: string, end: string) => `${formatDay(start)} · ${formatTime(start)}–${formatTime(end)}`;

/** <input type="datetime-local"> value in Bangkok time ↔ ISO UTC */
export function toLocalInput(iso: string) {
  const d = new Date(new Date(iso).getTime() + 7 * 3_600_000);
  return d.toISOString().slice(0, 16);
}
export const fromLocalInput = (v: string) => new Date(`${v}:00+07:00`).toISOString();

export const relative = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  return formatDay(iso);
};

export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en')} ${n === 1 ? one : many}`;
