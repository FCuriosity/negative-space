import {NativeEngine} from '../../packages/core/src/native-engine';
import {firstRunState,prepareFirstRule} from '../../packages/core/src/onboarding';
import {initialState} from '../../packages/core/src/seed';
import {startFocus,cancelFocus} from '../../packages/core/src/focus';
import {isMirrorOpening} from '../../packages/core/src/mirror-lake';
import type {AppState} from '../../packages/core/src/model';
export const androidApps=[{id:'wechat',name:'微信',pkg:'com.tencent.mm',color:'#65a66a',initials:'微'},{id:'bilibili-app',name:'哔哩哔哩',pkg:'tv.danmaku.bili',color:'#e981a4',initials:'哔'},{id:'xiaohongshu-app',name:'小红书',pkg:'com.xingin.xhs',color:'#da716c',initials:'红'},{id:'douyin-app',name:'抖音',pkg:'com.ss.android.ugc.aweme',color:'#657891',initials:'抖'}];
export function androidPolicy(s:AppState):AppState {
 return {...s,targets:androidApps.map(a=>({id:a.id,name:a.name,kind:'app',color:a.color,initials:a.initials,identities:[a.pkg]})),rules:s.rules.filter(r=>androidApps.some(a=>a.id===r.targetId)).map(r=>({...r,mode:'gentle',forceQuitOptIn:false})),lists:[{id:'entertainment',name:'娱乐与信息流',targetIds:['bilibili-app','xiaohongshu-app','douyin-app']},{id:'social',name:'社交通知',targetIds:['wechat']}],settings:{...s.settings,rewardTargetId:'bilibili-app'}};
}
export class AndroidRuntime {
 engine:NativeEngine;
 constructor(raw:string|null){
  const fresh=firstRunState(androidPolicy(initialState()));
  this.engine=new NativeEngine(raw??JSON.stringify({format:1,app:fresh,enabled:false,breaks:{},grants:{},notices:[]}));
  this.engine.data.app=androidPolicy(this.engine.policy());
  this.engine.setEnabled(false); // A killed service never silently resumes enforcement.
 }
 state(){return this.engine.policy();}
 snapshot(){return this.engine.serialize();}
 tick(pkg:string|null,at:number,mono:number,locked:boolean){
  const tracking=new Set(this.state().rules.filter(r=>r.enabled).map(r=>r.targetId));
  for(const session of this.state().sessions.filter(s=>s.status==='active'))for(const list of this.state().lists.filter(l=>session.listIds.includes(l.id)))for(const id of list.targetIds)tracking.add(id);
  const app=androidApps.find(a=>a.pkg===pkg&&tracking.has(a.id));
  const processes=androidApps.map((a,i)=>({pid:i+1,startedAt:1,executable:a.pkg,protected:false,bundleId:a.pkg}));
  const commands=this.engine.tick({at,monotonicMs:mono,idleSeconds:locked?9999:0,locked,frontBundleId:pkg==='cn.liubai.app'||pkg==='cn.liubai.app.preview'?'local.liubai.native':app?.pkg??null,processes});
  if(commands.some(c=>c.kind==='show'&&!this.engine.data.notices.some(n=>n.id===c.noticeId)))this.engine.clearReturnInterruption();
  // Android cannot terminate other apps: commands are deliberately not executed.
  return {state:this.state(),enabled:this.engine.data.enabled,notice:this.engine.data.notices[0]??null,overlayNotice:locked?null:this.engine.data.notices.find(n=>n.targetId===app?.id)??null};
 }
 call(method:string,args:any,now:number,mono:number){
  const e=this.engine;
  switch(method){
   case 'load':break;
   case 'save':e.updatePolicy(JSON.stringify(args.state),now);e.data.app=androidPolicy(e.policy());break;
   case 'first_rule':e.updatePolicy(JSON.stringify(prepareFirstRule(e.policy(),String(args.targetId),Number(args.minutes))),now);e.data.app=androidPolicy(e.policy());break;
   case 'management':if(typeof args.enabled!=='boolean')throw Error('开关参数不正确');e.setEnabled(args.enabled);break;
   case 'focus_start':{
    const minutes=Number(args.minutes);if(!Number.isInteger(minutes)||minutes<1||minutes>720)throw Error('请输入 1–720 分钟');
    e.data.app=startFocus(e.policy(),{id:`focus:${now}`,startedAt:now,endsAt:args.countUp?now:now+minutes*60000,durationMinutes:args.countUp?0:minutes,timerMode:args.countUp?'countup':'countdown',projectId:'personal',listIds:['entertainment'],mode:'gentle',status:'active'});break;
   }
   case 'timezone':{const timezone=String(args.timezone);new Intl.DateTimeFormat('zh-CN',{timeZone:timezone});e.data.app.settings.timezone=timezone;break;}
   case 'focus_finish':e.finishCountUp(String(args.id),now);break;
   case 'focus_cancel':e.data.app=cancelFocus(e.policy(),String(args.id),now,true);break;
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
  return {state:this.state(),enabled:e.data.enabled,notice:e.data.notices[0]??null};
 }
}
let runtime:AndroidRuntime;
export function initialize(raw:string|null){runtime=new AndroidRuntime(raw);return runtime.call('load',{},Date.now(),0);}
export function call(method:string,args:any,now:number,mono:number){return runtime.call(method,args,now,mono);}
export function tick(pkg:string|null,now:number,mono:number,locked:boolean){return runtime.tick(pkg,now,mono,locked);}
export function snapshot(){return runtime.snapshot();}
