import { hostMatches } from './browser';
import { account, advanceBreak, dailyUsage, type BreakState, type Sample } from './activity';
import { canOverride, evaluateTarget } from './rules';
import { dayKey } from './time';
import type { AppState, Decision } from './model';
export interface WebObservation { host:string; visit:string; active:boolean; at:number; monotonicMs:number; idleSeconds:number; locked:boolean }
/** Shared by browser integrations; stores platform IDs rather than URLs or page content. */
export class WebQuotaTracker {
  private previous:Sample|null=null;
  private visit='';
  private eventId='';
  private sequence=0;
  private blocked=false;
  private notices:Record<string,{mono:number;decision:Decision}>={};
  private grants:Record<string,{until:number;reason:Decision['reason']}>={};
  allow(state:AppState,targetId:string,now:number,mono:number,typed:string,reason:string) {
    const notice=this.notices[targetId];
    if(!notice?.decision.mode||!canOverride(notice.decision.mode,notice.mono,mono,typed,reason)||!reason.trim()||reason.length>300)throw new Error('尚未满足网页解除条件');
    this.grants[targetId]={until:now+300000,reason:notice.decision.reason};
    state.openReasons.push({id:`web-override:${now}:${++this.sequence}`,targetId,at:now,text:reason.trim(),source:'override',restriction:notice.decision.reason,grantedMinutes:5});
    delete this.notices[targetId];
  }
  private breaks:Record<string,BreakState>={};
  breakStates(): Readonly<Record<string, BreakState>> { return this.breaks; }
  leave() {this.previous=null;this.visit='';this.eventId='';}
  reset() {this.previous=null;this.visit='';this.eventId='';this.blocked=false;this.breaks={};this.notices={};this.grants={};}
  observe(state:AppState,enabled:boolean,o:WebObservation):{state:AppState;targetId?:string;decision:Decision;waitSeconds?:number} {
    if(!enabled){this.reset();return {state,decision:{action:'allow'}};}
    const target=state.targets.find(t=>t.kind==='website' && t.identities.some(domain=>hostMatches(o.host,domain)));
    const active=o.active&&!o.locked;
    const sample:Sample={at:o.at,monotonicMs:o.monotonicMs,idleSeconds:o.idleSeconds,locked:o.locked,projectId:state.sessions.find(s=>s.status==='active')?.projectId??'personal',targetId:active?target?.id??null:null};
    const interval=this.previous?account(this.previous,sample,state.settings.idleSeconds):null;
    if(interval){const last=state.usage.at(-1);if(last&&last.targetId===interval.targetId&&last.projectId===interval.projectId&&last.end===interval.start)last.end=interval.end;else state.usage.push(interval);}
    for(const t of state.targets.filter(t=>t.kind==='website')) {
      const rules=state.rules.filter(r=>r.enabled&&r.targetId===t.id&&r.breakEveryMinutes!==null);
      if(rules.length)this.breaks[t.id]=advanceBreak(this.breaks[t.id]??{continuousSeconds:0},o.at,interval?.targetId===t.id?(interval.end-interval.start)/1000:0,Math.min(...rules.map(r=>r.breakEveryMinutes!)),Math.max(...rules.map(r=>r.breakMinutes)));
    }
    const visit=active&&target?`${target.id}:${o.visit}`:'';
    if(visit&&visit!==this.visit){this.eventId=`web:${o.at}:${++this.sequence}`;state.opens.push({id:this.eventId,targetId:target!.id,at:o.at,kind:'navigation'});}
    this.visit=visit;
    const today=dayKey(o.at,state.settings.timezone);
    const opens=target?state.opens.filter(e=>e.targetId===target.id&&dayKey(e.at,state.settings.timezone)===today):[];
    const index=opens.findIndex(e=>e.id===this.eventId);
    const rest=target?this.breaks[target.id]:undefined;
    let decision=target?evaluateTarget(state,target.id,{now:o.at,timezone:state.settings.timezone,usedSeconds:dailyUsage(state.usage,state.settings.timezone,today,target.id),opens:index<0?opens.length:index,intent:'open',continuousSeconds:rest?.continuousSeconds??0,breakUntil:rest?.until,bonusMinutes:state.rewards.filter(r=>r.targetId===target.id&&r.day===today).reduce((n,r)=>n+r.minutes,0)}):{action:'allow' as const};
    if(target) {
      const grant=this.grants[target.id];
      if(grant&&grant.until>o.at&&grant.reason===decision.reason&&decision.mode!=='strict'&&decision.mode!=='managed')decision={action:'allow'};
      if(decision.action==='allow')delete this.notices[target.id];
      else if(!this.notices[target.id]||this.notices[target.id].decision.reason!==decision.reason)this.notices[target.id]={mono:o.monotonicMs,decision};
      else this.notices[target.id].decision=decision;
    }
    // Blocking pages are not time spent reading the target website.
    this.blocked=decision.action!=='allow';
    this.previous={...sample,targetId:this.blocked?null:sample.targetId};
    return {state,targetId:target?.id,decision,waitSeconds:target&&decision.mode==='friction'?Math.max(0,Math.ceil((this.notices[target.id].mono+30000-o.monotonicMs)/1000)):0};
  }
}
