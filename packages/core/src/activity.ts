import { daySlices } from './time';
import type { UsageInterval } from './model';
export interface Sample { at: number; monotonicMs: number; targetId: string | null; projectId: string; idleSeconds: number; locked: boolean }
/** Count the previous foreground target. Never count suspend gaps or a backwards wall clock. */
export function account(previous: Sample, current: Sample, idleThreshold = 60): UsageInterval | null {
  const elapsed = current.monotonicMs - previous.monotonicMs;
  if (!previous.targetId || previous.locked || current.locked || elapsed <= 0 || elapsed > 10_000 || current.at <= previous.at || Math.abs(current.at - previous.at - elapsed) > 2000) return null;
  if (previous.idleSeconds >= idleThreshold) return null;
  const activeMs = current.idleSeconds >= idleThreshold ? Math.max(0, elapsed - (current.idleSeconds - idleThreshold) * 1000) : elapsed;
  if (activeMs === 0) return null;
  return { id: `${previous.targetId}:${previous.at}`, targetId: previous.targetId, projectId: previous.projectId, start: previous.at, end: Math.min(current.at, previous.at + activeMs) };
}
export function dailyUsage(intervals: UsageInterval[], timezone: string, day: string, targetId?: string, projectId?: string) {
  return intervals.filter(i => (!targetId || i.targetId === targetId) && (!projectId || i.projectId === projectId)).reduce((total, interval) => total + daySlices(interval.start, interval.end, timezone).filter(s => s.day === day).reduce((n, s) => n + s.seconds, 0), 0);
}
export interface BreakState { continuousSeconds: number; until?: number; awaySince?: number }
/** Caller persists this per target; a completed break resets the accumulated continuous use. */
export function advanceBreak(state: BreakState, now: number, activeSeconds: number, everyMinutes: number, breakMinutes: number): BreakState {
  if (state.until && now < state.until) return state;
  if (state.until && now >= state.until) return { continuousSeconds: 0 };
  if (activeSeconds === 0) {
    const awaySince = state.awaySince ?? now;
    return now - awaySince >= breakMinutes * 60_000 ? { continuousSeconds: 0, awaySince } : { ...state, awaySince };
  }
  const continuousSeconds = state.continuousSeconds + activeSeconds;
  return continuousSeconds >= everyMinutes * 60 ? { continuousSeconds, until: now + breakMinutes * 60_000 } : { continuousSeconds };
}
