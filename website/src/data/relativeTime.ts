const relativeTime = new Intl.RelativeTimeFormat('en', { numeric: 'always' });
const units: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
  ['second', 1],
];

export function formatRelativeTime(value?: string | null, now = Date.now()): string | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  const seconds = (timestamp - now) / 1000;
  if (Math.abs(seconds) < 45) return 'just now';
  const [unit, unitSeconds] = units.find(([, size]) => Math.abs(seconds) >= size) ?? units[units.length - 1];
  return relativeTime.format(Math.round(seconds / unitSeconds), unit);
}
