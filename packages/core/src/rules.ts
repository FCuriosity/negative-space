import {isOpenEnded} from './focus';
import { clock } from './time';
import type { AppState, Decision, EvaluationContext, Mode, Rule, TimeWindow } from './model';
export function inWindow(at: number, timezone: string, window: TimeWindow) {
  const { weekday, minute } = clock(at, timezone);
  if (window.start < window.end) return window.days.includes(weekday) && minute >= window.start && minute < window.end;
  return (window.days.includes(weekday) && minute >= window.start) || (window.days.includes((weekday + 6) % 7) && minute < window.end);
}
const rank: Record<Mode, number> = { gentle: 1, friction: 2, managed: 3, strict: 4 };
function restriction(mode: Mode, reason: Decision['reason'], until?: number): Decision {
  return { mode, reason, until, action: { gentle: 'warn', friction: 'challenge', strict: 'block', managed: 'approval' }[mode] as Decision['action'] };
}
export function dailyLimits(rule:Rule,now:number,timezone:string) {
  return rule.weekdays[String(clock(now,timezone).weekday)] ?? rule;
}
export function evaluateRule(rule: Rule, context: EvaluationContext): Decision {
  if (!rule.enabled) return { action: 'allow' };
  const limits = dailyLimits(rule,context.now,context.timezone);
  const mode = context.sessionMode && rank[context.sessionMode] > rank[rule.mode] ? context.sessionMode : rule.mode;
  if (context.sessionMode) return restriction(mode, 'focus');
  if (rule.allowedWindows.length && !rule.allowedWindows.some(w => inWindow(context.now, context.timezone, w))) return restriction(mode, 'outside-window');
  if (context.breakUntil && context.now < context.breakUntil) return restriction(mode, 'break', context.breakUntil);
  if (rule.breakEveryMinutes !== null && context.continuousSeconds >= rule.breakEveryMinutes * 60) return restriction(mode, 'break');
  if (context.intent === 'open' && limits.dailyOpens !== null && context.opens >= limits.dailyOpens) return restriction(mode, 'daily-opens');
  if (limits.dailyMinutes !== null) {
    const remainingSeconds = Math.max(0, (limits.dailyMinutes + context.bonusMinutes) * 60 - context.usedSeconds);
    if (remainingSeconds === 0) return restriction(mode, 'daily-time');
    return { action: 'allow', remainingSeconds };
  }
  return { action: 'allow' };
}
export function activeMode(state: AppState, targetId: string, now: number): Mode | undefined {
  const listIds = state.lists.filter(l => l.targetIds.includes(targetId)).map(l => l.id);
  const sessions = state.sessions.filter(s => s.status === 'active' && now >= s.startedAt && (isOpenEnded(s)||now < s.endsAt) && s.listIds.some(id => listIds.includes(id))).map(s => s.mode);
  const schedules = state.schedules.filter(s => s.enabled && !s.focusSpace && s.listIds.some(id => listIds.includes(id)) && s.windows.some(w => inWindow(now, state.settings.timezone, w))).map(s => s.mode);
  return [...sessions, ...schedules].sort((a, b) => rank[b] - rank[a])[0];
}
export function evaluateTarget(state: AppState, targetId: string, context: EvaluationContext): Decision {
  if (state.targets.find(t => t.id === targetId)?.protected) return { action: 'allow' };
  const sessionMode = activeMode(state, targetId, context.now);
  const decisions = state.rules.filter(r => r.targetId === targetId).map(rule => evaluateRule(rule, { ...context, sessionMode }));
  if (sessionMode) decisions.push(restriction(sessionMode, 'focus'));
  return decisions.filter(d => d.action !== 'allow').sort((a,b) => rank[b.mode!] - rank[a.mode!])[0] ?? { action: 'allow' };
}
export const CHALLENGE_TEXT = '我确认这次打开有明确目的';
export function canOverride(mode: Mode, startedAt: number, now: number, typed: string, reason: string) {
  if (mode === 'gentle') return true;
  if (mode !== 'friction') return false;
  return now >= startedAt + 30_000 && typed === CHALLENGE_TEXT && reason.trim().length >= 5;
}
