import type { AppState } from './model';
import type { BreakState } from './activity';
import { isOpenEnded } from './focus';

export interface MenuBarState {
  kind: 'idle' | 'focus' | 'break';
  title: string;
  detail: string;
}
export function menuBarClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const pad = (n: number) => String(n).padStart(2, '0');
  return total >= 3600
    ? `${pad(Math.floor(total / 3600))}:${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}`
    : `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}
/** Read-only presentation. Focus continues when application management is paused. */
export function menuBarState(app: AppState, enabled: boolean, breaks: Readonly<Record<string, BreakState>>, now: number): MenuBarState {
  const management = enabled ? '应用管理中' : '应用管理已暂停';
  const focus = app.sessions.find(s => s.status === 'active' && s.startedAt <= now && (isOpenEnded(s) || s.endsAt > now));
  if (focus) {
    const countup = isOpenEnded(focus);
    const time = menuBarClock(countup ? (now - focus.startedAt) / 1000 : Math.ceil((focus.endsAt - now) / 1000));
    return { kind: 'focus', title: `专注 ${time}`, detail: `留白 · ${countup ? '正向计时' : '专注剩余'} ${time} · ${management}` };
  }
  // If several targets are resting, show the time until all active breaks finish.
  const resting = enabled ? app.targets.filter(t => (breaks[t.id]?.until ?? 0) > now && app.rules.some(r => r.targetId === t.id && r.enabled && r.breakEveryMinutes !== null)) : [];
  if (resting.length) {
    const until = Math.max(...resting.map(t => breaks[t.id].until!));
    const time = menuBarClock(Math.ceil((until - now) / 1000));
    return { kind: 'break', title: `休息 ${time}`, detail: `留白 · ${resting.map(t => t.name).join('、')}休息剩余 ${time}` };
  }
  return { kind: 'idle', title: '', detail: `留白 · ${management}` };
}
