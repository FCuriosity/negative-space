import {useState} from 'react';
import {ArrowRight,Check,Leaf,ShieldCheck,Bell} from 'lucide-react';
import type {AppState} from '../../../packages/core/src';
import type {NativeStatus} from './native';
import './first-run.css';

export function FirstRun({state,status,desktop,onSave,onFinish,onDismiss}:{state:AppState;status:NativeStatus|null;desktop:boolean;onSave:(targetId:string,minutes:number)=>Promise<void>;onFinish:(enable:boolean)=>Promise<void>;onDismiss:()=>void}) {
 const saved=state.rules.find(r=>r.id===state.settings.onboarding?.ruleId);
 const [step,setStep]=useState(saved?3:1),[targetId,setTargetId]=useState(saved?.targetId??''),[minutes,setMinutes]=useState(String(saved?.dailyMinutes??30));
 const [demo,setDemo]=useState(false),[experienced,setExperienced]=useState(!!saved),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const apps=state.targets.filter(t=>t.kind==='app'&&!t.protected),target=apps.find(t=>t.id===targetId);
 const valid=Number.isInteger(Number(minutes))&&Number(minutes)>=1&&Number(minutes)<=180;
 const identified=!!target&&!!status?.installedApps.some(a=>target.identities.includes(a.bundleId)&&(a.installed||a.running));
 const run=async(fn:()=>Promise<void>)=>{setBusy(true);setError('');try{await fn();}catch(e){setError(String(e));}finally{setBusy(false);}};
 return <div className="modal-backdrop first-run-backdrop"><section className="modal first-run" role="dialog" aria-modal="true" aria-labelledby="first-run-title">
  <div className="first-run-brand"><img src="./brand/liubai-icon.svg" width={32} height={32} alt="留白"/><span>从一件小事开始</span><button className="text-button" disabled={busy} onClick={onDismiss}>稍后设置</button></div>
  <ol className="first-run-steps" aria-label="首次引导进度">{['选择应用','温和规则','体验提醒'].map((label,i)=><li key={label} aria-current={step===i+1?'step':undefined} className={step>=i+1?'reached':''}><span>{step>i+1?<Check size={13}/>:i+1}</span>{label}</li>)}</ol>
  <h1 id="first-run-title">{step===1?'哪一个应用，最容易让你分心？':step===2?'先给它留一段有边界的时间':experienced&&!demo?'你已经体验了第一条规则':'安全地体验一次提醒'}</h1>
  {step===1&&<><p className="first-run-lead">只选一个就好，其余的以后再安排</p><div className="first-run-apps" role="group" aria-label="选择一个分心应用">{apps.map(app=><button key={app.id} className={targetId===app.id?'selected':''} aria-pressed={targetId===app.id} onClick={()=>setTargetId(app.id)}><span className="app-icon" style={{background:`${app.color}24`}}>{app.initials}</span><strong>{app.name}</strong>{targetId===app.id&&<Check size={17}/>}</button>)}</div><div className="first-run-note"><Leaf size={18}/><span>现在还没有开启管理，只管理你接下来选择的这一条规则</span></div><div className="modal-actions"><button className="button primary" disabled={!target} onClick={()=>setStep(2)}>选好了，下一步<ArrowRight size={16}/></button></div></>}
  {step===2&&<><p className="first-run-lead">{target?.name} · 温和规则</p><label className="first-run-duration">每天可用时长<div><input aria-label="首次规则每日分钟数" type="number" min={1} max={180} value={minutes} onChange={e=>{setMinutes(e.target.value);setExperienced(false);}}/><span>分钟</span></div></label><div className="first-run-summary"><h2>这条规则什么时候生效？</h2><p>开启正式管理后，{target?.name}在前台且未空闲的时间，累计达到 {valid?minutes:'所设'} 分钟时提醒你</p><p>每天零点重新计算 · {state.settings.timezone}<br/>后台运行不计时，连续 {state.settings.idleSeconds} 秒无操作视为空闲</p><p>提醒后有 60 秒保存工作，也可填写理由继续 5 分钟；未选择继续，到时会请求正常退出应用，强制退出保持关闭</p></div><div className="modal-actions"><button className="button secondary" onClick={()=>setStep(1)}>上一步</button><button className="button primary" disabled={!valid} onClick={()=>{setExperienced(false);setDemo(false);setStep(3);}}>下一步，安全体验</button></div></>}
  {step===3&&<>
   {!demo&&!experienced&&<><p className="first-run-lead">假设{target?.name}已经用满 {minutes} 分钟，看看留白会怎样提醒你</p><div className="first-run-note"><ShieldCheck size={20}/><span>这是界面演示，不会启动、关闭或限制真实应用，也不会写入使用次数、理由或镜湖记录</span></div><button className="button primary first-run-demo-button" onClick={()=>setDemo(true)}><Bell size={17}/>体验一次提醒</button></>}
   {demo&&<div className="first-run-demo" role="region" aria-label="安全提醒演示"><span className="mode-tag">安全演示 · 不影响真实应用</span><h2>{target?.name}，今天的时间用完了</h2><p>先保存手头的工作，再决定要不要继续</p><p className="muted small">正式管理时会留出 60 秒保存；本次演示不倒计时、不发送退出请求</p><button className="button secondary" disabled={busy} onClick={()=>void run(async()=>{await onSave(targetId,Number(minutes));setDemo(false);setExperienced(true);})}>我看懂了，结束演示</button></div>}
   {experienced&&!demo&&<><div className="first-run-summary"><h2><Check size={18}/>已保存一条温和规则</h2><p><strong>{target?.name} · 每天 {minutes} 分钟</strong></p><p>点击「开启这条规则」后开始管理，前台累计用满后提醒，每天零点重置</p><p>正式提醒会留 60 秒保存工作，之后请求正常退出；可填写理由继续 5 分钟，不会强制退出</p><p>可在「连接管理」暂停；关闭留白窗口后继续管理，从菜单栏或托盘退出留白后停止</p></div>{!desktop?<p className="first-run-note">当前是浏览器预览，只能保存规则；请在留白桌面应用中开启正式管理</p>:!status?<p className="first-run-note">正在连接本机管理服务</p>:!identified?<p className="first-run-note">尚未识别到{target?.name}，可以先打开一次该应用，再回到留白；也可以仅保存规则，稍后开启</p>:null}<div className="modal-actions"><button className="button secondary" disabled={busy} onClick={()=>void run(()=>onFinish(false))}>仅保存，稍后开启</button>{desktop&&<button className="button primary" disabled={busy||!status||!identified} onClick={()=>void run(()=>onFinish(true))}>开启这条规则</button>}</div></>}
   <div className="first-run-bottom"><button className="text-button" disabled={busy} onClick={()=>{setStep(2);setDemo(false);}}>调整规则</button>{experienced&&!demo&&<button className="text-button" disabled={busy} onClick={()=>setDemo(true)}>再看一次演示</button>}</div>
  </>}
  {error&&<p className="error-text" role="alert">{error}</p>}
 </section></div>;
}
