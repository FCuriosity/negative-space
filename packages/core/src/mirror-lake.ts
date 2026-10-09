import type { AppState, OpenEvent } from './model';
import { dailyQuota } from './quota';
import { dayKey } from './time';
import { inWindow } from './rules';

/** Snapshot the rule at activation; never infer historical intent from today's rules. */
export function outsideAllowedWindow(state:AppState,targetId:string,now:number) {
  return state.rules.some(r=>r.enabled && r.targetId===targetId && r.allowedWindows.length>0 && !r.allowedWindows.some(w=>inWindow(now,state.settings.timezone,w)));
}
export const isMirrorOpening=(event:OpenEvent)=>!!(event.quotaExceeded?.length || event.outsideAllowedWindow);

/** Called before inserting this activation: the Nth permitted entry is not excess. */
export function quotaExcessBeforeOpen(state:AppState,targetId:string,now:number):NonNullable<OpenEvent['quotaExceeded']> {
  if(!state.targets.some(t=>t.id===targetId && t.kind==='app')) return [];
  const reasons=new Set<'daily-time'|'daily-opens'>();
  for(const rule of state.rules.filter(r=>r.enabled && r.targetId===targetId)) {
    const quota=dailyQuota(state,rule,now);
    if(quota.totalSeconds!==null && quota.usedSeconds>=quota.totalSeconds) reasons.add('daily-time');
    if(quota.limits.dailyOpens!==null && quota.opens>=quota.limits.dailyOpens) reasons.add('daily-opens');
  }
  return [...reasons];
}
export function classifyOpening(state:AppState,id:string,intention:string):AppState {
  if(!['pending','intentional','accidental'].includes(intention)) throw new Error('请选择有效的打开意图');
  const event=state.opens.find(o=>o.id===id);
  if(!event || !isMirrorOpening(event) || !state.targets.some(t=>t.id===event.targetId && t.kind==='app')) throw new Error('这条记录没有打开时的超额或时段外信息');
  return {...state,opens:state.opens.map(o=>o.id===id?{...o,intention:intention as OpenEvent['intention']}:o)};
}
/** Light is a visual metaphor, never an input to permissions or earned entertainment time. */
export function mirrorLight(stars:number,holes:number) { return Math.max(0,Math.min(1,(stars-holes)/5)); }
export function mirrorLake(state:AppState,now:number,todayOnly=false) {
  const cutoff=now-state.settings.retentionDays*86400000;
  const within=(at:number)=>at>=cutoff && at<=now && (!todayOnly || dayKey(at,state.settings.timezone)===dayKey(now,state.settings.timezone));
  const stars=[...new Map(state.sessions.filter(s=>s.status==='completed' && within(s.endedAt??s.endsAt)).map(s=>[s.id,s])).values()];
  const entries=[...new Map(state.opens.filter(o=>isMirrorOpening(o) && within(o.at) && state.targets.some(t=>t.id===o.targetId && t.kind==='app')).map(o=>[o.id,o])).values()].sort((a,b)=>b.at-a.at);
  const holes=entries.filter(o=>o.intention==='accidental');
  const pending=entries.filter(o=>!o.intention || o.intention==='pending');
  return {stars,entries,holes,pending,light:mirrorLight(stars.length,holes.length)};
}
