import { dayKey } from './time';
import type { AppState, FocusSession } from './model';
export const validFocusMinutes = (minutes: number) => Number.isInteger(minutes) && minutes >= 1 && minutes <= 720;
export const isOpenEnded=(s:FocusSession)=>s.timerMode==='countup'&&!s.scheduleId;
export function validFocusSession(s:FocusSession){return Number.isFinite(s.startedAt)&&(isOpenEnded(s)?s.durationMinutes===0&&s.endsAt===s.startedAt&&(s.mode==='gentle'||s.mode==='friction'):validFocusMinutes(s.durationMinutes)&&s.endsAt===s.startedAt+s.durationMinutes*60000);}
/** Idempotent settlement: cancelled sessions never create a reward, and one session settles once. */
export function settleFocus(state: AppState, now: number): AppState {
  const completed = state.sessions.filter(s => s.status === 'active' && !isOpenEnded(s) && now >= s.endsAt);
  return completeSessions(state,completed,now);
}
function completeSessions(state:AppState,completed:FocusSession[],now:number):AppState {
  if (!completed.length) return state;
  const sessions: FocusSession[] = state.sessions.map(s => completed.some(c => c.id === s.id) ? { ...s, status: 'completed', endedAt:s.endsAt, creditedAt: now } : s);
  const { timezone, rewardEveryMinutes, rewardMinutes, rewardTargetId } = state.settings;
  const rewards = [...state.rewards];
  for (const day of new Set(completed.map(s => dayKey(s.endsAt, timezone)))) {
    const eligible = sessions.filter(s => s.status === 'completed' && dayKey(s.endsAt, timezone) === day);
    const totalMinutes = eligible.reduce((n, s) => n + s.durationMinutes, 0);
    const earned = Math.floor(totalMinutes / rewardEveryMinutes) * rewardMinutes;
    const existing = rewards.filter(r => r.day === day && r.targetId === rewardTargetId).reduce((n, r) => n + r.minutes, 0);
    if (earned > existing) rewards.push({ id: `reward:${day}:${earned}`, day, targetId: rewardTargetId, minutes: earned - existing, sessionIds: eligible.map(s => s.id) });
  }
  return { ...state, sessions, rewards, audit: [...state.audit, ...completed.map(s => ({ id: `completed:${s.id}`, at: s.endsAt, type: 'focus-completed' as const, message: `完成 ${Math.floor(s.durationMinutes)} 分钟${Math.floor(s.durationMinutes*60)%60 ? ` ${Math.floor(s.durationMinutes*60)%60} 秒` : ''}专注` }))] };
}
export function startFocus(state: AppState, session: FocusSession): AppState {
  const settled = settleFocus(state, session.startedAt);
  if (settled.sessions.some(s => s.status === 'active')) throw new Error('已有专注正在进行');
  if (!validFocusSession(session)) throw new Error('专注时长不合法');
  return { ...settled, sessions: [...settled.sessions, session], audit: [...settled.audit, { id: `started:${session.id}`, at: session.startedAt, type: 'focus-started', message: isOpenEnded(session)?'开始正向专注计时':`开始 ${session.durationMinutes} 分钟专注` }] };
}
export function cancelFocus(state: AppState, id: string, now: number, overrideGranted: boolean): AppState {
  const session = state.sessions.find(s => s.id === id);
  if (!session || session.status !== 'active') return state;
  if (session.mode === 'strict' || session.mode === 'managed' || !overrideGranted) throw new Error('当前专注不可提前解除');
  return { ...state, sessions: state.sessions.map(s => s.id === id ? { ...s, status: 'cancelled', endedAt:now } : s), audit: [...state.audit, { id: `cancelled:${id}`, at: now, type: 'focus-cancelled', message: '提前结束专注（不计入奖励）' }] };
}

/** Finishing an open-ended timer is completion, not an early exit from a fixed commitment. */
export function finishCountUp(state:AppState,id:string,now:number):AppState {
 const session=state.sessions.find(s=>s.id===id);
 if(!session||session.status!=='active')return state;
 if(!isOpenEnded(session))throw new Error('只有手动正向计时可以随时完成');
 if(!Number.isFinite(now)||now<session.startedAt)throw new Error('结束时间不能早于开始时间');
 const durationMinutes=(now-session.startedAt)/60000;
 const final={...session,endsAt:now,durationMinutes};
 const next={...state,sessions:state.sessions.map(s=>s.id===id?final:s)};
 if(durationMinutes<1)return {...next,sessions:next.sessions.map(s=>s.id===id?{...s,status:'cancelled' as const,endedAt:now}:s),audit:[...next.audit,{id:`cancelled:${id}`,at:now,type:'focus-cancelled',message:'正向计时不足 1 分钟，保存为短暂尝试'}]};
 return completeSessions(next,[final],now);
}
