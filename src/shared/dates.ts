// Calendar arithmetic and the date copy rules. All dates are handled in UTC so a
// given dataset always renders the same way.

const DAY = 86_400_000;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Parse "2026-11-05" or a full timestamp into epoch milliseconds. */
export function toTime(iso: string): number {
  const t = Date.parse(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(t)) throw new Error(`Not a date: ${iso}`);
  return t;
}

/** The calendar date (UTC) of a date or timestamp, as "YYYY-MM-DD". */
export function dateOnly(iso: string): string {
  return new Date(toTime(iso)).toISOString().slice(0, 10);
}

/** Whole calendar days from a to b. Positive when b is later. */
export function daysBetween(a: string, b: string): number {
  return Math.round((toTime(dateOnly(b)) - toTime(dateOnly(a))) / DAY);
}

export function addDays(iso: string, days: number): string {
  return new Date(toTime(dateOnly(iso)) + days * DAY).toISOString().slice(0, 10);
}

/** "Wednesday 11 November" */
export function longDate(iso: string): string {
  const d = new Date(toTime(iso));
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "21 November" */
export function dayMonth(iso: string): string {
  const d = new Date(toTime(iso));
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "21 Nov" */
export function shortDayMonth(iso: string): string {
  const d = new Date(toTime(iso));
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}`;
}

/** "Dec" style month label for the milestone axis, or "1 Dec" with day. */
export function monthStart(iso: string): string {
  return shortDayMonth(iso);
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "6 days", "1 day" */
export function days(n: number): string {
  return plural(n, 'day');
}

/**
 * Age of a backlog card: "3 days", "1 week", "2 weeks", "1 month".
 * Under a day reads as "today".
 */
export function age(fromIso: string, today: string): string {
  const d = Math.max(0, daysBetween(fromIso, today));
  if (d === 0) return 'today';
  if (d < 14 && d !== 7) return days(d);
  if (d < 30) return plural(Math.floor(d / 7), 'week');
  if (d < 365) return plural(Math.floor(d / 30), 'month');
  return plural(Math.floor(d / 365), 'year');
}

/**
 * "4 hours ago", "yesterday", "3 days ago". Hours are used only when a full timestamp
 * and the current moment are known; a calendar date from today reads "today".
 */
export function ago(iso: string, today: string, now?: string): string {
  const d = daysBetween(iso, today);
  if (d <= 0) {
    if (iso.length > 10 && now) {
      const hours = Math.floor((toTime(now) - toTime(iso)) / 3_600_000);
      if (hours < 1) return 'just now';
      return `${plural(hours, 'hour')} ago`;
    }
    return 'today';
  }
  if (d === 1) return 'yesterday';
  if (d < 14) return `${days(d)} ago`;
  return `${age(iso, today)} ago`;
}

/** "6 minutes ago" for the sync status line. */
export function minutesAgo(iso: string, now: string): string {
  const mins = Math.max(0, Math.floor((toTime(now) - toTime(iso)) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${plural(mins, 'minute')} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${plural(hours, 'hour')} ago`;
  return `${plural(Math.floor(hours / 24), 'day')} ago`;
}
