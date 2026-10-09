import type { AppState, FocusSession } from './model';
import { dayKey } from './time';
export function sessionEndedAt(state:AppState,session:FocusSession) {
  return session.endedAt ?? (session.status==='cancelled' ? state.audit.find(a=>a.id===`cancelled:${session.id}`)?.at ?? session.startedAt : session.endsAt);
}
export function saveReflection(state:AppState,sessionId:string,text:string,now:number):AppState {
  const session=state.sessions.find(s=>s.id===sessionId);
  if(!session || session.status==='active') throw new Error('专注结束后才能写心得');
  const value=text.trim();
  if(!value || value.length>2000) throw new Error('心得请填写 1–2000 个字');
  const previous=state.reflections.find(r=>r.sessionId===sessionId);
  const reflection={sessionId,text:value,createdAt:previous?.createdAt??now,updatedAt:now};
  return {...state,reflections:[...state.reflections.filter(r=>r.sessionId!==sessionId),reflection]};
}
export function saveOpenReason(state:AppState,eventId:string,text:string,now:number,skip=false,intention?:string):AppState {
  const event=state.opens.find(o=>o.id===eventId);
  if(!event || !state.targets.some(t=>t.id===event.targetId && t.kind==='app')) throw new Error('这条应用打开记录不存在');
  const value=text.trim();
  const choice=intention??event.intention;
  if(event.outsideAllowedWindow && (skip || !['intentional','accidental'].includes(choice??''))) throw new Error('时段外打开，请填写理由并确认是否无意识打开');
  if(!skip && (!value || value.length>300)) throw new Error('打开理由请填写 1–300 个字');
  const reasonId=`open-reason:${event.id}`;
  if(skip && state.openReasons.some(r=>r.id===reasonId)) return state;
  return {...state,opens:state.opens.map(o=>o.id===eventId?{...o,reasonStatus:skip?'skipped':'recorded',...(event.outsideAllowedWindow?{intention:choice as 'intentional'|'accidental'}:{})}:o),openReasons:skip?state.openReasons:[...state.openReasons.filter(r=>r.id!==reasonId),{id:reasonId,eventId,targetId:event.targetId,at:now,text:value,source:'open'}]};
}
export function journalCounts(state:AppState,days:string[],targetId='all') {
  const appIds=new Set(state.targets.filter(t=>t.kind==='app').map(t=>t.id));
  const opens=state.opens.filter(o=>appIds.has(o.targetId) && (targetId==='all'||o.targetId===targetId) && days.includes(dayKey(o.at,state.settings.timezone)));
  const sessions=state.sessions.filter(s=>s.status!=='active' && days.includes(dayKey(sessionEndedAt(state,s),state.settings.timezone)));
  const reflections=state.reflections.filter(r=>sessions.some(s=>s.id===r.sessionId));
  const overrides=state.openReasons.filter(r=>r.source==='override' && (targetId==='all'||r.targetId===targetId) && days.includes(dayKey(r.at,state.settings.timezone)));
  return {opens,sessions,reflections,overrides,completed:sessions.filter(s=>s.status==='completed').length};
}
