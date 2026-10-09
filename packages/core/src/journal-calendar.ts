import { dayKey } from './time';

export interface JournalCalendarNode<T> {
  key: string;
  kind: 'month' | 'week' | 'day';
  title: string;
  start: string;
  end: string;
  closed: boolean;
  items: T[];
  children: JournalCalendarNode<T>[];
}

// Arithmetic on calendar dates, rather than elapsed 24-hour periods, also works across DST.
export function shiftCalendarDay(day: string, offset: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
export function calendarWeekStart(day: string): string {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  return shiftCalendarDay(day, -((weekday + 6) % 7));
}
export function recentCalendarDays(now: number, timezone: string, count: number): string[] {
  const today = dayKey(now, timezone);
  return Array.from({ length: count }, (_, index) => shiftCalendarDay(today, -index));
}
const shortDate = (day: string) => `${Number(day.slice(5, 7))}月${Number(day.slice(8))}日`;
function group<T>(items: T[], key: (item: T) => string): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const id = key(item);
    const bucket = groups.get(id) ?? [];
    bucket.push(item);
    groups.set(id, bucket);
  }
  return [...groups].sort(([a], [b]) => b.localeCompare(a));
}

/** Month → calendar week → day; each event belongs to exactly one day and month. */
export function buildJournalCalendar<T>(items: T[], at: (item: T) => number, now: number, timezone: string): JournalCalendarNode<T>[] {
  const today = dayKey(now, timezone);
  const currentMonth = today.slice(0, 7);
  const currentWeek = calendarWeekStart(today);
  const sorted = [...items].sort((a, b) => at(b) - at(a));
  const dates = new Map(sorted.map(item => [item, dayKey(at(item), timezone)]));
  return group(sorted, item => dates.get(item)!.slice(0, 7)).map(([month, monthItems]) => {
    const start = `${month}-01`;
    const monthDate = new Date(`${start}T12:00:00Z`);
    monthDate.setUTCMonth(monthDate.getUTCMonth() + 1);
    const end = shiftCalendarDay(monthDate.toISOString().slice(0, 10), -1);
    const closed = month < currentMonth;
    return {
      key: `month:${month}`, kind: 'month', title: `${Number(month.slice(0, 4))}年${Number(month.slice(5))}月`, start, end, closed, items: monthItems,
      children: group(monthItems, item => calendarWeekStart(dates.get(item)!)).map(([week, weekItems]) => {
        const weekEnd = shiftCalendarDay(week, 6);
        const weekStartInMonth = week < start ? start : week;
        const weekEndInMonth = weekEnd > end ? end : weekEnd;
        const partial = weekStartInMonth !== week || weekEndInMonth !== weekEnd;
        return {
          key: `week:${month}:${week}`, kind: 'week', start: weekStartInMonth, end: weekEndInMonth,
          title: `${shortDate(weekStartInMonth)}—${shortDate(weekEndInMonth)}${partial ? ' · 跨月周' : ''}`,
          closed: closed || week < currentWeek, items: weekItems,
          children: group(weekItems, item => dates.get(item)!).map(([day, dayItems]) => ({
            key: `day:${day}`, kind: 'day', title: day === today ? '今天' : day === shiftCalendarDay(today, -1) ? '昨天' : shortDate(day),
            start: day, end: day, closed: day < today, items: dayItems, children: [],
          })),
        };
      }),
    };
  });
}
