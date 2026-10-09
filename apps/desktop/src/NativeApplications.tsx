import {hasRecoveryReason} from '../../../packages/core/src/reason-tags';
import { OpeningIntention } from './OpeningIntention';
import { ReasonTags } from './ReasonTags';
import { useState } from 'react';
import { Monitor,ShieldCheck } from 'lucide-react';
import { CHALLENGE_TEXT,canOverride,dailyUsage,dayKey,modeLabels,reasonLabels,type AppState } from '../../../packages/core/src';
import { callNative,nativeDesktop,type NativeStatus } from './native';
import type { NativeNotice } from '../../../packages/core/src/native-engine';

export function NativeApplications({ status,state,onStatus,notify }: { status:NativeStatus|null;state:AppState;onStatus:(s:NativeStatus)=>void;notify:(s:string)=>void }) {
  const [busy,setBusy]=useState(false);
  const toggle=async()=>{setBusy(true);try {onStatus(await callNative<NativeStatus>('set_management',{enabled:!status?.enabled}));} catch(e){notify(String(e));}finally{setBusy(false);}};
  const today=dayKey(Date.now(),state.settings.timezone);
  return <section className="native-apps"><div className="native-apps-heading"><div><h2><Monitor size={18}/>电脑应用管理</h2><p>{nativeDesktop ? status?.enabled ? '正在统计前台使用，配额到点后提醒保存并请求正常退出' : '先检查下面的应用配额，再开启本机管理' : '网页仅用于预览请打开项目里的「留白」管理电脑应用'}</p></div><button disabled={!nativeDesktop||busy||!status} className={`button ${status?.enabled?'secondary':'primary'}`} onClick={toggle}>{busy?'正在处理…':status?.enabled?'暂停管理':'开始管理这些应用'}</button></div><div className="native-app-list">{['bilibili-app','xiaohongshu-app','wechat'].map(id=>{const target=state.targets.find(t=>t.id===id);if(!target)return null;const installed=status?.installedApps.find(a=>target.identities.includes(a.bundleId));const count=state.opens.filter(o=>o.targetId===id&&dayKey(o.at,state.settings.timezone)===today).length;const seconds=Math.floor(dailyUsage(state.usage,state.settings.timezone,today,id));return <div key={id}><span className="app-icon" style={{background:`${target.color}24`,color:'#273e3f'}}>{target.initials}</span><div><strong>{target.name}</strong><p>{nativeDesktop?(status?.platform==='Windows'?(installed?.running?`运行中已识别 · ${installed.processName??''}`:installed?.installed?'已安装，等待运行识别':'尚未识别，请先打开应用'):(installed?.installed?'已识别本机应用':'未找到安装')):'桌面应用'} · {Math.floor(seconds/60)} 分 {seconds%60} 秒 · {count} 次打开</p></div><span className={`connection-dot ${(status?.platform==='Windows'?installed?.running:installed?.installed)?'connected':''}`}/></div>;})}</div>{status?.enabled&&<p className="small muted">当前前台：{status.frontApp} · 空闲 {Math.floor(status.idleSeconds)} 秒 · 每次从其他应用切回算一次，留白提醒后的返回不重复计数</p>}{status?.lastError&&<p className="error-text" role="alert">{status.lastError}</p>}<div className="native-apps-foot"><ShieldCheck size={13}/><span>关闭留白窗口后继续管理；从菜单栏退出留白后停止应用内容、聊天记录和窗口标题不采集</span></div></section>;
}

export function NativeChallenge({ notice,status,onStatus,notify,state,onSaveTags }: { state:AppState;onSaveTags:(tags:string[])=>Promise<void>;notice:NativeNotice;status:NativeStatus;onStatus:(s:NativeStatus)=>void;notify:(s:string)=>void }) {
  const event=state.opens.find(o=>o.id===notice.openEventId);
  const needsReview=!!event?.outsideAllowedWindow;
  const [typed,setTyped]=useState('');
  const [reason,setReason]=useState(state.openReasons.find(r=>r.eventId===event?.id&&r.source==='open')?.text??'');
  const [intention,setIntention]=useState(event?.intention==='pending'?'':event?.intention??'');
  const [forceConfirm,setForceConfirm]=useState(false);const [busy,setBusy]=useState(false);
  const mode=notice.decision.mode!;
  const seconds=Math.max(0,Math.ceil((notice.quit.deadline-status.sampledAt)/1000));
  const wait=Math.min(30,Math.max(0,Math.ceil((notice.createdMono+30000-status.monotonicMs)/1000)));
  const reviewReady=!!reason.trim()&&(!needsReview||!!intention);
  const can=canOverride(mode,notice.createdMono,status.monotonicMs,typed,reason)&&reviewReady;
  const action=async(method:string,args:Record<string,unknown>={})=>{setBusy(true);try{const result=await callNative<NativeStatus>(method,{noticeId:notice.id,...args});if(method==='allow_app')onStatus(result);else if(method==='quit_now'||method==='force_quit')notify('已向应用发送退出请求');}catch(e){notify(String(e));}finally{setBusy(false);}};
  const leave=async()=>{if(!event)return;setBusy(true);try{await callNative('close_opening',{id:event.id,text:reason});onStatus(await callNative<NativeStatus>('native_status'));notify('理由已记录，已请求正常关闭应用');}catch(e){notify(String(e));}finally{setBusy(false);}};
  const record=async()=>{if(!event)return;setBusy(true);try{await callNative('save_open_reason',{id:event.id,text:reason,intention,skip:false,returnToApp:false});notify(intention==='accidental'?'理由已保存，这次无意识打开已记入镜湖':'理由与意图已保存，不增加黑洞');}catch(e){notify(String(e));}finally{setBusy(false);}};
  return <div className="modal-backdrop"><section className="modal narrow" role="dialog" aria-modal="true" aria-labelledby="native-challenge-title">
    <div className="eyebrow">{modeLabels[mode]} · 电脑应用</div><h2 id="native-challenge-title">{needsReview?'在约定之外，先停一下':`${notice.name} 需要休息一下`}</h2><p>{notice.name} · {reasonLabels[notice.decision.reason!]}</p>
    {needsReview&&<p className="window-review-help">这次在允许时段外打开了应用留下理由，并由你确认是否无意识；只有确认无意识后，才会记入镜湖</p>}
    {notice.quit.stage==='grace'?<p className="native-grace">还有 <strong>{seconds}</strong> 秒保存工作，之后会请求应用正常退出</p>:notice.quit.stage==='request-quit'?<p>已请求应用正常退出，正在等待它完成请处理应用自己的保存提示</p>:<p>应用尚未退出请保存工作后手动退出；留白不会自动强制结束</p>}
    {(needsReview||mode==='gentle'||mode==='friction')&&<><ReasonTags tags={state.settings.reasonTags} text={reason} onText={setReason} onSave={onSaveTags} disabled={busy}/><label>{mode==='friction'?'打开理由（临时放行至少 5 个字）':'这次打开的理由'}<textarea aria-label="打开理由" maxLength={300} value={reason} onChange={e=>setReason(e.target.value)} placeholder="例如：回复一条必要消息，或只是习惯性点开"/></label></>}
    {needsReview&&<><OpeningIntention value={intention} onChange={setIntention} disabled={busy}/><button className="button secondary" disabled={busy||!reviewReady} onClick={()=>void record()}>记录理由与判断</button>{event?.reasonStatus==='recorded'&&<p className="small muted">已保存 · {event.intention==='accidental'?'已记入镜湖':'不增加黑洞'}可修改后再次保存</p>}</>}
    {mode==='friction'&&<><p>临时继续使用需要等待 <strong>{wait}</strong> 秒、填写至少 5 字理由并完成挑战</p><label>完整输入「{CHALLENGE_TEXT}」<input autoComplete="off" value={typed} onChange={e=>setTyped(e.target.value)}/></label></>}
    {(mode==='strict'||mode==='managed')&&<p>当前等级不允许临时放行，记录理由与判断不会解除限制</p>}
    <div className="native-notice-actions">{event&&hasRecoveryReason(reason)&&<button className="button primary" disabled={busy} onClick={()=>void leave()}>记录理由，关闭应用</button>}<button className="button secondary" disabled={busy} onClick={()=>action('return_to_app')}>回到应用保存工作</button><button className="button secondary" disabled={busy} onClick={()=>action('quit_now')}>我已保存，正常退出</button>{(mode==='gentle'||mode==='friction')&&<button className="button primary" disabled={busy||!can} onClick={()=>action('allow_app',{typed,reason,intention:needsReview?intention:undefined})}>记录并继续使用 5 分钟</button>}</div>
    {notice.quit.forceQuitOptIn&&notice.quit.stage==='needs-confirmation'&&<div className="form-section"><label className="checkbox-line"><input type="checkbox" checked={forceConfirm} onChange={e=>setForceConfirm(e.target.checked)}/>我确认已保存，理解强制退出可能丢失数据</label><button className="button secondary" disabled={!forceConfirm||busy} onClick={()=>action('force_quit',{confirmed:forceConfirm})}>强制退出此应用</button></div>}
  </section></div>;
}
