import {hasRecoveryReason} from './reason-tags';
import { menuBarState } from './menu-bar';
import {advanceFocusSchedule} from './focus-spaces';
import { WebQuotaTracker, type WebObservation } from './web-quota';
import { quotaExcessBeforeOpen, classifyOpening, outsideAllowedWindow, isMirrorOpening } from './mirror-lake';
import { account, advanceBreak, dailyUsage, type BreakState, type Sample } from './activity';
import { dayKey } from './time';
import { activeMode, canOverride, evaluateTarget } from './rules';
import { beginQuit, advanceQuit, type ProcessIdentity, type QuitPlan } from './enforcement';
import { initialState, newRule } from './seed';
import { parseState, pruneHistory } from './state';
import { settleFocus, validFocusSession, finishCountUp } from './focus';
import { saveReflection, saveOpenReason } from './journal';
import type { AppState, Decision, OpenEvent } from './model';

export interface NativeProcess extends ProcessIdentity { bundleId: string }
export interface NativeObservation { at: number; monotonicMs: number; idleSeconds: number; locked: boolean; frontBundleId: string | null; processes: NativeProcess[] }
export interface NativeNotice { id: string; openEventId?: string; targetId: string; name: string; decision: Decision; createdAt: number; createdMono: number; quit: QuitPlan; quitSent: boolean }
export interface NativeSnapshot { format: 1; app: AppState; enabled: boolean; breaks: Record<string,BreakState>; grants: Record<string,{ until: number; reason: Decision['reason'] }>; notices: NativeNotice[] }
export interface NativeCommand { kind: 'quit' | 'show'; noticeId: string; process: NativeProcess }

/** Existing website targets are preserved; these IDs always refer to desktop applications. */
export function withNativeTargets(state: AppState): AppState {
  const result = structuredClone(state);
  const targets = [
    { id:'bilibili-app', name:'哔哩哔哩 App',kind:'app' as const,color:'#e981a4',initials:'哔',identities:['com.bilibili.bilibiliPC'] },
    { id:'xiaohongshu-app',name:'小红书 App',kind:'app' as const,color:'#da716c',initials:'红',identities:['com.xingin.discover'] },
  ];
  for (const t of targets) {
    if (!result.targets.some(x => x.id === t.id)) {
      result.targets.push(t);
      result.rules.push({ ...newRule(`${t.id}-daily`,t.id === 'bilibili-app' ? '给 B 站 App 留半小时' : '给小红书 App 留二十分钟',t.id), dailyMinutes:t.id === 'bilibili-app' ? 30 : 20, breakEveryMinutes:20 });
      const list=result.lists.find(l => l.id === 'entertainment'); if (list) list.targetIds.push(t.id);
    }
  }
  if(!result.targets.some(t=>t.id==='zhihu')) {
    result.targets.push({id:'zhihu',name:'知乎网页版',kind:'website',color:'#638fbd',initials:'知',identities:['zhihu.com']});
    for(const id of ['zhihu','xiaohongshu']) if(!result.rules.some(r=>r.targetId===id)) result.rules.push({...newRule(`${id}-web`,id==='zhihu'?'知乎网页打开前停一下':'小红书网页打开前停一下',id),dailyMinutes:0});
    const list=result.lists.find(l=>l.id==='entertainment');if(list&&!list.targetIds.includes('zhihu'))list.targetIds.push('zhihu');
  }
  if (result.settings.rewardTargetId === 'bilibili') result.settings.rewardTargetId='bilibili-app';
  return result;
}
export function nativeInitialState(): AppState {
  const state=withNativeTargets(initialState());
  state.rules=state.rules.filter(r => ['bilibili-app','xiaohongshu-app','wechat','zhihu','xiaohongshu'].includes(r.targetId));
  return state;
}

export class NativeEngine {
  data: NativeSnapshot;
  private webTracker=new WebQuotaTracker();
  observeWebsite(observation:WebObservation) { const result=this.webTracker.observe(this.data.app,this.data.enabled,observation);this.data.app=result.state;return {enabled:this.data.enabled,targetId:result.targetId,decision:result.decision,waitSeconds:result.waitSeconds}; }
  allowWebsite(targetId:string,now:number,mono:number,typed:string,reason:string) {this.webTracker.allow(this.data.app,targetId,now,mono,typed,reason);}
  private previous: Sample | null=null;
  private lastFrontKey:string|null=null;
  private interruption:{key:string;seen:boolean}|null=null;
  private initialized=false;
  private counter=0;
  constructor(raw?: string | null) {
    if (raw) {
      const saved=JSON.parse(raw) as NativeSnapshot;
      if (saved.format !== 1 || typeof saved.enabled !== 'boolean' || !saved.breaks || !saved.grants) throw new Error('原生数据版本不正确');
      this.data={ ...saved,app:withNativeTargets(parseState(saved.app)),notices:[],grants:{} };
    } else this.data={ format:1,app:nativeInitialState(),enabled:false,breaks:{},grants:{},notices:[] };
  }
  serialize() { return JSON.stringify(this.data); }
  policy() { return this.data.app; }
  menuBar(now:number) { return menuBarState(this.data.app,this.data.enabled,{...this.data.breaks,...this.webTracker.breakStates()},now); }
  setEnabled(enabled: boolean) { this.data.enabled=enabled; this.webTracker.reset(); this.previous=null; this.initialized=false; this.lastFrontKey=null; this.interruption=null; this.data.notices=[]; this.data.grants={}; }
  /** The native engine owns usage/opens/rewards. UI snapshots cannot overwrite them. */
  updatePolicy(raw: string, now: number) {
    const candidate=withNativeTargets(parseState(JSON.parse(raw)));
    const current=this.data.app;
    const locked=current.sessions.some(s => s.status === 'active' && s.mode === 'strict' && now < s.endsAt);
    if (locked && (JSON.stringify(candidate.rules)!==JSON.stringify(current.rules) || JSON.stringify(candidate.lists)!==JSON.stringify(current.lists) || JSON.stringify(candidate.schedules)!==JSON.stringify(current.schedules))) throw new Error('严格专注期间不能修改限制规则');
    for (const session of current.sessions) {
      if (session.status === 'active' && session.mode === 'strict' && now < session.endsAt && !candidate.sessions.some(s => s.id === session.id && JSON.stringify(s) === JSON.stringify(session))) throw new Error('严格专注期间不能删除或修改会话');
    }
    const sessions=candidate.sessions.map(s => {
      const existing=current.sessions.find(x => x.id === s.id);
      if (!existing && s.status === 'active' && !validFocusSession(s)) throw new Error('专注时长请设置为 1–720 分钟的整数');
      return existing && existing.status !== 'active' ? existing : s;
    });
    for(const session of current.sessions) if(session.scheduleId&&!sessions.some(s=>s.id===session.id))sessions.push(session);
    const audit=[...current.audit];
    for (const event of candidate.audit) if (!audit.some(a => a.id === event.id)) audit.push(event);
    this.data.app=settleFocus({ ...candidate,sessions,scheduleRuns:current.scheduleRuns,usage:current.usage,opens:current.opens,reflections:current.reflections,openReasons:current.openReasons,rewards:current.rewards,audit },now);
  }
  private target(bundleId: string | null) { return this.data.app.targets.find(t => t.kind === 'app' && !t.protected && bundleId && t.identities.includes(bundleId)); }
  tick(observation: NativeObservation): NativeCommand[] {
    const { at,monotonicMs,idleSeconds,locked,frontBundleId,processes }=observation;
    if(!['com.google.Chrome','com.microsoft.edgemac'].includes(frontBundleId??''))this.webTracker.leave();
    this.data.app=advanceFocusSchedule(this.data.app,at,this.data.enabled,locked);
    if (!this.data.enabled) return [];
    const app=this.data.app;
    const target=this.target(frontBundleId);
    const projectId=app.sessions.find(s => s.status === 'active')?.projectId ?? 'personal';
    const sample: Sample={ at,monotonicMs,idleSeconds,locked,targetId:target?.id ?? null,projectId };
    const interval=this.previous ? account(this.previous,sample,app.settings.idleSeconds) : null;
    if (interval) {
      const last=app.usage[app.usage.length-1];
      if (last && last.targetId === interval.targetId && last.projectId === interval.projectId && last.end === interval.start && dayKey(last.start,app.settings.timezone) === dayKey(interval.end-1,app.settings.timezone)) last.end=interval.end;
      else app.usage.push(interval);
    }
    this.previous=sample;
    const processKey=(p: NativeProcess) => `${p.pid}:${p.startedAt}:${p.bundleId}`;
    const newOpens: OpenEvent[]=[];
    const frontProcess=processes.find(p=>p.bundleId===frontBundleId && !p.protected);
    const frontKey=target && frontProcess ? processKey(frontProcess) : null;
    const isLiubai=frontBundleId==='local.liubai.native';
    if(this.interruption) {
      if(isLiubai) this.interruption.seen=true;
      else if(frontKey!==this.interruption.key) this.interruption=null;
    }
    if(this.initialized && !locked && frontKey && target && frontKey!==this.lastFrontKey) {
      if(this.interruption?.key===frontKey && this.interruption.seen) this.interruption=null;
      else {
        const event:OpenEvent={id:`activation:${frontKey}:${at}:${++this.counter}`,targetId:target.id,at,kind:'activation',processKey:frontKey,reasonStatus:'pending'};
        for(const previous of app.opens) if(previous.reasonStatus==='pending') previous.reasonStatus='skipped';
        event.quotaExceeded=quotaExcessBeforeOpen(app,target.id,at);
        event.outsideAllowedWindow=outsideAllowedWindow(app,target.id,at);
        if(isMirrorOpening(event)) event.intention='pending';
        app.opens.push(event);newOpens.push(event);
      }
    }
    for(const event of app.opens) if(event.reasonStatus==='pending' && event.processKey && !processes.some(p=>processKey(p)===event.processKey)) event.reasonStatus='skipped';
    this.lastFrontKey=isLiubai ? 'liubai' : frontKey;
    this.initialized=true;
    for (const t of app.targets.filter(t => t.kind === 'app')) {
      const rules=app.rules.filter(r => r.enabled && r.targetId === t.id && r.breakEveryMinutes !== null);
      if (!rules.length) continue;
      const every=Math.min(...rules.map(r => r.breakEveryMinutes!));
      const rest=Math.max(...rules.map(r => r.breakMinutes));
      const activeSeconds=interval?.targetId === t.id ? (interval.end-interval.start)/1000 : 0;
      this.data.breaks[t.id]=advanceBreak(this.data.breaks[t.id] ?? {continuousSeconds:0},at,activeSeconds,every,rest);
    }
    const commands: NativeCommand[]=[];
    const today=dayKey(at,app.settings.timezone);
    for (const p of processes) {
      const t=this.target(p.bundleId); if (!t || p.protected) continue;
      let notice=this.data.notices.find(n => n.targetId === t.id && n.quit.process.pid === p.pid && n.quit.process.startedAt === p.startedAt);
      const launches=app.opens.filter(o => o.targetId === t.id && dayKey(o.at,app.settings.timezone) === today);
      const visit=launches.filter(o=>o.processKey===processKey(p) || o.id===`launch:${processKey(p)}`).at(-1);
      const launchIndex=launches.findIndex(o=>o.id===visit?.id);
      // The latest foreground visit owns the opening limit for this process.
      const opened=newOpens.some(o => o.targetId === t.id);
      const opening=launchIndex >= 0;
      const breakState=this.data.breaks[t.id] ?? {continuousSeconds:0};
      let decision=evaluateTarget(app,t.id,{ now:at,timezone:app.settings.timezone,usedSeconds:dailyUsage(app.usage,app.settings.timezone,today,t.id),opens:opening ? launchIndex : launches.length,intent:opening ? 'open' : 'continue',continuousSeconds:breakState.continuousSeconds,breakUntil:breakState.until,bonusMinutes:app.rewards.filter(r => r.targetId === t.id && r.day === today).reduce((n,r) => n+r.minutes,0) });
      const grant=this.data.grants[t.id];
      if (grant && grant.until > at && grant.reason === decision.reason && decision.mode !== 'strict' && decision.mode !== 'managed') { this.data.notices=this.data.notices.filter(n => n !== notice); continue; }
      if (decision.action === 'allow') { this.data.notices=this.data.notices.filter(n => n !== notice); continue; }
      // Avoid disrupting background apps before the user actually enters them, except a fresh blocked launch.
      if (!notice && t.id !== target?.id && !opened) continue;
      if (!notice) {
        const rules=app.rules.filter(r => r.enabled && r.targetId === t.id);
        notice={ id:`notice:${p.pid}:${at}:${++this.counter}`,targetId:t.id,name:t.name,openEventId:visit?.id,decision,createdAt:at,createdMono:monotonicMs,quit:beginQuit(p,at,Math.max(60,...rules.map(r => r.graceSeconds)),rules.some(r => r.forceQuitOptIn)),quitSent:false };
        this.data.notices.push(notice); this.interruption={key:processKey(p),seen:false}; commands.push({ kind:'show',noticeId:notice.id,process:p });
      } else { notice.decision=decision; if(opened)notice.openEventId=visit?.id; }
      notice.quit=advanceQuit(notice.quit,at,true);
      if (notice.quit.stage === 'request-quit' && !notice.quitSent) { notice.quitSent=true; commands.push({ kind:'quit',noticeId:notice.id,process:p }); }
    }
    this.data.notices=this.data.notices.filter(n => processes.some(p => p.pid === n.quit.process.pid && p.startedAt === n.quit.process.startedAt));
    for (const event of newOpens) {
      const p=processes.find(p=>this.target(p.bundleId)?.id===event.targetId);
      if(p && !commands.some(c=>c.kind==='show')) { this.interruption={key:processKey(p),seen:false}; commands.push({kind:'show',noticeId:event.id,process:p}); }
    }
    this.data.app=pruneHistory(app,at);
    return commands;
  }
  private closedOpeningState(id:string,text:string,now:number) {
    const event=this.data.app.opens.find(o=>o.id===id);
    if(!event || this.data.app.opens.filter(o=>o.targetId===event.targetId).at(-1)?.id!==id) throw new Error('这次打开已结束，请使用当前打开记录');
    if(!hasRecoveryReason(text)) throw new Error('请选择「无意识，但改邪归正」后确认关闭');
    let state=saveOpenReason(this.data.app,id,text,now,false,'accidental');
    if(isMirrorOpening(event)) state=classifyOpening(state,id,'accidental');
    return state;
  }
  closeOpeningProcess(id:string,text:string,now:number,processes:NativeProcess[]) {
    this.closedOpeningState(id,text,now);
    const event=this.data.app.opens.find(o=>o.id===id)!;
    const process=processes.find(p=>!p.protected && `${p.pid}:${p.startedAt}:${p.bundleId}`===event.processKey && this.target(p.bundleId)?.id===event.targetId);
    if(!process) throw new Error('原应用进程已退出或变化，请刷新后重试');
    return process;
  }
  recordClosedOpening(id:string,text:string,now:number) {this.data.app=this.closedOpeningState(id,text,now);}
  prepareReturn(identity:NativeProcess) { this.interruption={key:`${identity.pid}:${identity.startedAt}:${identity.bundleId}`,seen:true}; this.lastFrontKey='liubai'; }
  finishCountUp(id:string,now:number) { this.data.app=finishCountUp(this.data.app,id,now); }
  saveReflection(sessionId:string,text:string,now:number) { this.data.app=saveReflection(this.data.app,sessionId,text,now); }
  classifyOpening(eventId:string,intention:string) { this.data.app=classifyOpening(this.data.app,eventId,intention); }
  saveOpenReason(eventId:string,text:string,now:number,skip=false,intention?:string) { this.data.app=saveOpenReason(this.data.app,eventId,text,now,skip,intention); }
  allow(noticeId: string, now: number, monotonicMs: number, typed: string, reason: string, intention?:string): string {
    const notice=this.data.notices.find(n => n.id === noticeId);
    if (!notice || !notice.decision.mode || !canOverride(notice.decision.mode,notice.createdMono,monotonicMs,typed,reason)) throw new Error('尚未满足解除条件');
    if (activeMode(this.data.app,notice.targetId,now) === 'strict') throw new Error('严格专注期间不可解除');
    const value=reason.trim();
    if(value.length>300) throw new Error('打开理由最多 300 个字');
    const pending=this.data.app.opens.find(o=>o.id===notice.openEventId)??this.data.app.opens.filter(o=>o.targetId===notice.targetId && o.reasonStatus==='pending').at(-1);
    if(notice.decision.reason==='outside-window' && !value) throw new Error('时段外使用需要填写理由');
    if(pending) this.saveOpenReason(pending.id,value,now,!value,intention);
    this.data.app.openReasons.push({id:`override:${notice.id}`,targetId:notice.targetId,at:now,text:value,source:'override',restriction:notice.decision.reason,grantedMinutes:5});
    this.data.grants[notice.targetId]={ until:now+5*60000,reason:notice.decision.reason };
    this.data.notices=this.data.notices.filter(n => n.id !== noticeId);
    return notice.targetId;
  }
}
