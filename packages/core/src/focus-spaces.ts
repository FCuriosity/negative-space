import {z} from 'zod';
import type {AppState,FocusSpace,Schedule} from './model';
import {FocusSpaceSchema} from './model';
import {clock} from './time';
import {settleFocus,startFocus} from './focus';
export const spaceTones={mint:{name:'林间',color:'#d1dfcf'},blue:{name:'海岸',color:'#ccdde8'},rose:{name:'晨光',color:'#ead3d5'},lavender:{name:'暮色',color:'#dcd3e8'}} as const;
export const formatMinute=(n:number)=>`${String(Math.floor((n%1440)/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
/** Calendar coordinates refer to the module's top edge. Snap only the start, never its duration. */
export function dropMinute(y:number,height:number){return Math.max(0,Math.min(1435,Math.round(y/height*1440/5)*5));}
export function focusPlacement(space:FocusSpace,day:number,start:number,id:string):Schedule {
 const valid=FocusSpaceSchema.parse(space);
 z.number().int().min(0).max(6).parse(day);z.number().int().min(0).max(1439).parse(start);
 return {id,name:valid.name,listIds:[...valid.listIds],mode:valid.mode,enabled:true,focusSpace:{...valid,listIds:[...valid.listIds]},windows:[{days:[day],start,end:(start+valid.durationMinutes)%1440}]};
}
function spans(s:Schedule){return s.windows.flatMap(w=>w.days.flatMap(day=>{const a=day*1440+w.start,b=a+(w.end>w.start?w.end-w.start:1440-w.start+w.end);return b>10080?[[a,10080],[0,b-10080]]:[[a,b]];}));}
export function placementConflict(schedules:Schedule[],candidate:Schedule){
 if(!candidate.enabled)return undefined;
 return schedules.find(s=>s.id!==candidate.id&&s.enabled&&s.focusSpace&&spans(s).some(([a,b])=>spans(candidate).some(([c,d])=>a<d&&c<b)));
}
export function putFocusPlacement(state:AppState,candidate:Schedule):AppState {
 const conflict=placementConflict(state.schedules,candidate);
 if(conflict)throw new Error(`与「${conflict.name}」重叠，请换一个时间`);
 return {...state,schedules:[...state.schedules.filter(s=>s.id!==candidate.id),candidate]};
}
export function startFocusSpace(state:AppState,space:FocusSpace,now:number,id:string,scheduleId?:string){
 const valid=FocusSpaceSchema.parse(space);
 if(!state.projects.some(p=>p.id===valid.projectId)||valid.listIds.some(id=>!state.lists.some(l=>l.id===id)))throw new Error('场景中的项目或屏蔽列表已删除，请先编辑场景');
 const openEnded=valid.timerMode==='countup'&&!scheduleId;
 return startFocus(state,{id,scheduleId,timerMode:valid.timerMode,backgroundId:valid.backgroundId,startedAt:now,endsAt:openEnded?now:now+valid.durationMinutes*60000,durationMinutes:openEnded?0:valid.durationMinutes,projectId:valid.projectId,listIds:[...valid.listIds],mode:valid.mode,status:'active',spaceName:valid.name,spaceTone:valid.tone});
}
/** Only start an occurrence in its starting minute; never fabricate missed sessions on reopen. */
export function advanceFocusSchedule(state:AppState,now:number,enabled=true,locked=false):AppState {
 let next=settleFocus(state,now);
 if(!enabled)return next;
 const {day,weekday,minute}=clock(now,state.settings.timezone);
 for(const schedule of next.schedules.filter(s=>s.enabled&&s.focusSpace)){
  if(!schedule.windows.some(w=>w.days.includes(weekday)&&w.start===minute))continue;
  const occurrence=`${schedule.id}:${day}:${minute}`;
  if(next.scheduleRuns.some(r=>r.id===occurrence))continue;
  const at=now-now%60000;
  let outcome:'started'|'busy'|'locked'|'invalid'=locked?'locked':next.sessions.some(s=>s.status==='active')?'busy':'started';
  if(outcome==='started'){
   try{next=startFocusSpace(next,schedule.focusSpace!,at,`scheduled:${occurrence}`,schedule.id);}catch{outcome='invalid';}
  }
  next={...next,scheduleRuns:[...next.scheduleRuns,{id:occurrence,scheduleId:schedule.id,at,outcome}]};
 }
 return next;
}
