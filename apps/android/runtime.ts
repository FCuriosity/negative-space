import {NativeEngine} from '../../packages/core/src/native-engine';
import {firstRunState,prepareFirstRule} from '../../packages/core/src/onboarding';
import {initialState} from '../../packages/core/src/seed';
import {startFocus,cancelFocus} from '../../packages/core/src/focus';
import {startFocusSpace,advanceFocusSchedule} from '../../packages/core/src/focus-spaces';
import {activeMode,canOverride} from '../../packages/core/src/rules';
import {parseState} from '../../packages/core/src/state';
import {normalizeReasonTags} from '../../packages/core/src/reason-tags';
import {isMirrorOpening} from '../../packages/core/src/mirror-lake';
import type {AppState} from '../../packages/core/src/model';
export const androidApps=[{id:'wechat',name:'微信',pkg:'com.tencent.mm',color:'#65a66a',initials:'微'},{id:'bilibili-app',name:'哔哩哔哩',pkg:'tv.danmaku.bili',color:'#e981a4',initials:'哔'},{id:'xiaohongshu-app',name:'小红书',pkg:'com.xingin.xhs',color:'#da716c',initials:'红'},{id:'douyin-app',name:'抖音',pkg:'com.ss.android.ugc.aweme',color:'#657891',initials:'抖'}];
export function androidPolicy(s:AppState):AppState {
 const defaults=[{id:'entertainment',name:'娱乐与信息流',targetIds:['bilibili-app','xiaohongshu-app','douyin-app']},{id:'social',name:'社交通知',targetIds:['wechat']}];
 const systemLists=androidApps.map(a=>({id:`focus-app:${a.id}`,name:a.name,targetIds:[a.id]}));
 const lists=[...s.lists.filter(l=>!l.id.startsWith('focus-app:')).map(l=>({...l,targetIds:[...new Set(l.targetIds.map(id=>({bilibili:'bilibili-app',xiaohongshu:'xiaohongshu-app',douyin:'douyin-app'}[id]??id)).filter(id=>androidApps.some(a=>a.id===id)))]})),...systemLists];
 for(const list of defaults)if(!lists.some(l=>l.id===list.id))lists.push(list);
 return {...s,targets:androidApps.map(a=>({id:a.id,name:a.name,kind:'app',color:a.color,initials:a.initials,identities:[a.pkg]})),rules:s.rules.filter(r=>androidApps.some(a=>a.id===r.targetId)).map(r=>({...r,mode:r.mode==='managed'?'friction':r.mode,forceQuitOptIn:false})),lists,settings:{...s.settings,rewardTargetId:androidApps.some(a=>a.id===s.settings.rewardTargetId)?s.settings.rewardTargetId:'bilibili-app'}};
}
export class AndroidRuntime {
 engine:NativeEngine;
 private cancelStarted=new Map<string,number>();
 constructor(raw:string|null){
  const fresh=firstRunState(androidPolicy(initialState()));
  this.engine=new NativeEngine(raw??JSON.stringify({format:1,app:fresh,enabled:false,breaks:{},grants:{},notices:[]}));
  this.engine.data.app=androidPolicy(this.engine.policy());
  // The native service validates persisted user intent and permissions before resuming.
  // A UI-only engine must not pretend that foreground monitoring is already running.
  this.engine.setEnabled(false);
 }
 state(){return this.engine.policy();}
 snapshot(){return this.engine.serialize();}
 tick(pkg:string|null,at:number,mono:number,locked:boolean){
  this.engine.data.app=advanceFocusSchedule(this.state(),at,this.engine.data.enabled,locked);
  const tracking=new Set(this.state().rules.filter(r=>r.enabled).map(r=>r.targetId));
  for(const session of this.state().sessions.filter(s=>s.status==='active'))for(const list of this.state().lists.filter(l=>session.listIds.includes(l.id)))for(const id of list.targetIds)tracking.add(id);
  for(const a of androidApps)if(activeMode(this.state(),a.id,at))tracking.add(a.id);
  const app=androidApps.find(a=>a.pkg===pkg&&tracking.has(a.id));
  const processes=androidApps.map((a,i)=>({pid:i+1,startedAt:1,executable:a.pkg,protected:false,bundleId:a.pkg}));
  const commands=this.engine.tick({at,monotonicMs:mono,idleSeconds:locked?9999:0,locked,frontBundleId:pkg==='cn.liubai.app'||pkg==='cn.liubai.app.preview'||pkg==='cn.liubai.app.preview2'||pkg==='cn.liubai.app.preview3'?'local.liubai.native':app?.pkg??null,processes});
  if(commands.some(c=>c.kind==='show'&&!this.engine.data.notices.some(n=>n.id===c.noticeId)))this.engine.clearReturnInterruption();
  // Android cannot terminate other apps: commands are deliberately not executed.
  return {state:this.state(),monotonicMs:mono,enabled:this.engine.data.enabled,notice:this.engine.data.notices[0]??null,overlayNotice:locked?null:this.engine.data.notices.find(n=>n.targetId===app?.id)??null};
 }
 call(method:string,args:any,now:number,mono:number){
  const e=this.engine;
  switch(method){
   case 'load':case 'load_notice':break;
   case 'save':e.updatePolicy(JSON.stringify(args.state),now);e.data.app=androidPolicy(e.policy());break;
   case 'patch':{
    const patch=args.patch??{};const allowed=['settings','rules','lists','projects','focusSpaces','focusBackgrounds','schedules','tasks','habits'];
    if(Object.keys(patch).some(k=>!allowed.includes(k)))throw Error('不支持的编辑字段');
    e.updatePolicy(JSON.stringify({...e.policy(),...patch,settings:{...e.policy().settings,...patch.settings}}),now);e.data.app=androidPolicy(e.policy());break;
   }
   case 'save_tags':e.data.app.settings.reasonTags=normalizeReasonTags(args.tags);break;
   case 'restore':{
    if(e.policy().sessions.some(s=>s.status==='active'))throw Error('请先完成当前专注再恢复备份');
    const restored=androidPolicy(parseState(args.state,now));
    restored.sessions=restored.sessions.map(s=>s.status==='active'?{...s,status:'cancelled',endedAt:now}:s);
    this.engine=new NativeEngine(JSON.stringify({format:1,app:restored,enabled:false,breaks:{},grants:{},notices:[]}));this.engine.data.app=restored;return {state:restored,enabled:false,notice:null,monotonicMs:mono};
   }
   case 'first_rule':e.updatePolicy(JSON.stringify(prepareFirstRule(e.policy(),String(args.targetId),Number(args.minutes))),now);e.data.app=androidPolicy(e.policy());break;
   case 'management':if(typeof args.enabled!=='boolean')throw Error('开关参数不正确');if(e.data.enabled!==args.enabled)e.setEnabled(args.enabled);break;
   case 'focus_start':{
    const minutes=Number(args.minutes);if(!Number.isInteger(minutes)||minutes<1||minutes>720)throw Error('请输入 1–720 分钟');
    const targetIds=args.targetIds??androidApps.map(a=>a.id);
    if(!Array.isArray(targetIds)||targetIds.some(id=>!androidApps.some(a=>a.id===id)))throw Error('请选择支持的应用');
    if(args.manage===true&&!targetIds.length)throw Error('请至少选择一个提醒应用');
    const mode=args.mode??'gentle';if(!['gentle','friction','strict'].includes(mode)||args.countUp&&mode==='strict')throw Error('请选择有效的自律等级');
    const projectId=args.projectId??'personal';if(!e.policy().projects.some(p=>p.id===projectId))throw Error('项目已不存在');
    const listIds=args.listIds??[...new Set<string>(targetIds)].map(id=>`focus-app:${id}`);
    if(!Array.isArray(listIds)||listIds.some(id=>!e.policy().lists.some(l=>l.id===id)))throw Error('屏蔽列表已不存在');
    const previous=e.data.app;
    e.data.app=startFocus(e.policy(),{id:`focus:${now}`,startedAt:now,endsAt:args.countUp?now:now+minutes*60000,durationMinutes:args.countUp?0:minutes,timerMode:args.countUp?'countup':'countdown',projectId,listIds,mode,spaceTone:e.policy().settings.focusTone,backgroundId:e.policy().settings.focusBackgroundId,status:'active'});
    try{if(args.manage===true&&!e.data.enabled)e.setEnabled(true);}catch(error){e.data.app=previous;throw error;}break;
   }
   case 'space_start':{
    const space=e.policy().focusSpaces.find(s=>s.id===args.id);if(!space)throw Error('专注空间已不存在');
    const previous=e.data.app;e.data.app=startFocusSpace(e.policy(),space,now,`focus:${now}`);
    try{if(args.manage===true&&!e.data.enabled)e.setEnabled(true);}catch(error){e.data.app=previous;throw error;}break;
   }
   case 'focus_start_failed':{e.data.app={...e.data.app,sessions:e.data.app.sessions.map(s=>s.id===args.id&&s.status==='active'?{...s,status:'cancelled',endedAt:now}:s)};break;}
   case 'focus_cancel_begin':{if(!this.cancelStarted.has(args.id))this.cancelStarted.set(args.id,mono);break;}
   case 'timezone':{const timezone=String(args.timezone);new Intl.DateTimeFormat('zh-CN',{timeZone:timezone});e.data.app.settings.timezone=timezone;break;}
   case 'focus_finish':e.finishCountUp(String(args.id),now);break;
   case 'focus_cancel':{
    const session=e.policy().sessions.find(s=>s.id===args.id);
    if(session&&session.mode!=='gentle'&&!canOverride(session.mode,this.cancelStarted.get(args.id)??Infinity,mono,args.typed??'',args.reason??''))throw Error('尚未满足提前结束条件');
    e.data.app=cancelFocus(e.policy(),String(args.id),now,true);this.cancelStarted.delete(args.id);break;
   }
   case 'leave':{
    const notice=e.data.notices.find(n=>n.id===args.id);if(!notice)throw Error('这次提醒已结束');
    if(!String(args.reason??'').trim()||!['intentional','accidental'].includes(args.intention))throw Error('请填写理由并确认意图');
    if(notice.openEventId){e.saveOpenReason(notice.openEventId,String(args.reason),now,false,args.intention);const event=e.policy().opens.find(o=>o.id===notice.openEventId);if(event&&isMirrorOpening(event))e.classifyOpening(event.id,args.intention);}e.data.notices=e.data.notices.filter(n=>n.id!==args.id);e.clearReturnInterruption();break;
   }
   case 'reflection':e.saveReflection(String(args.id),String(args.text),now);break;
   case 'reason':e.saveOpenReason(String(args.id),String(args.text),now,false,args.intention);break;
   case 'classify':e.classifyOpening(String(args.id),String(args.intention));break;
   case 'allow':{
    if(!['intentional','accidental'].includes(args.intention))throw Error('请确认这次打开的意图');
    const notice=e.data.notices.find(n=>n.id===args.id);const event=e.policy().opens.find(o=>o.id===notice?.openEventId);
    e.allow(String(args.id),now,mono,String(args.typed??''),String(args.reason??''),args.intention);
    if(event&&isMirrorOpening(event))e.classifyOpening(event.id,args.intention);break;
   }
   default:throw Error('不支持的操作');
  }
  return {state:this.state(),monotonicMs:mono,cancelStarted:Object.fromEntries(this.cancelStarted),enabled:e.data.enabled,notice:(method==='load_notice'?e.data.notices.find(n=>n.id===args.id):e.data.notices[0])??null};
 }
}
let runtime:AndroidRuntime;
export function initialize(raw:string|null){runtime=new AndroidRuntime(raw);return runtime.call('load',{},Date.now(),0);}
export function call(method:string,args:any,now:number,mono:number){return runtime.call(method,args,now,mono);}
export function tick(pkg:string|null,now:number,mono:number,locked:boolean){return runtime.tick(pkg,now,mono,locked);}
export function snapshot(){return runtime.snapshot();}
