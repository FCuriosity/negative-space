const formatters = new Map<string, Intl.DateTimeFormat>();
export function clock(at: number, timezone: string) {
  let formatter = formatters.get(timezone);
  if (!formatter) { formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' }); formatters.set(timezone, formatter); }
  const parts = Object.fromEntries(formatter.formatToParts(at).map(p => [p.type, p.value]));
  return { day: `${parts.year}-${parts.month}-${parts.day}`, weekday: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(parts.weekday), minute: Number(parts.hour) * 60 + Number(parts.minute) };
}
export const dayKey = (at: number, timezone: string) => clock(at, timezone).day;
export function daySlices(start: number, end: number, timezone: string): { day: string; seconds: number }[] {
  const result = [];
  while (start < end) {
    const day = dayKey(start, timezone);
    let boundary = end;
    if (dayKey(end - 1, timezone) !== day) {
      let lo = start, hi = Math.min(end, start + 26 * 3600_000);
      while (hi - lo > 1) { const mid = Math.floor((hi + lo) / 2); if (dayKey(mid, timezone) === day) lo = mid; else hi = mid; }
      boundary = hi;
    }
    result.push({ day, seconds: (boundary - start) / 1000 }); start = boundary;
  }
  return result;
}
