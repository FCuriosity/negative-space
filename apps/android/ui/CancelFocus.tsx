import {useState} from 'react';
import {CHALLENGE_TEXT,canOverride} from '../../../packages/core/src/rules';
import type {Result} from './bridge';
export function CancelFocus({result,id,close,run}:{result:Result;id:string;close:()=>void;run:(method:string,args:any)=>Promise<any>}){
 const s=result.state.sessions.find(s=>s.id===id)!;const [typed,setTyped]=useState(''),[reason,setReason]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);const started=result.cancelStarted?.[id]??Infinity;
 const can=canOverride(s.mode,started,result.monotonicMs,typed,reason);
 return <div className="modal-backdrop"><section className="modal narrow" role="dialog" aria-modal="true" aria-labelledby="cancel-title"><h2 id="cancel-title">停一下，确认你的选择</h2><p>提前结束不会获得专注星星与奖励</p>{s.mode==='strict'?<p>本次严格约定不提供提前结束，可以退出沉浸界面，计时仍会继续</p>:s.mode==='friction'?<><p>还需等待 {Number.isFinite(started)?Math.max(0,Math.ceil((started+30000-result.monotonicMs)/1000)):30} 秒</p><label>结束的理由（至少 5 个字）<textarea value={reason} onChange={e=>setReason(e.target.value)}/></label><label>完整输入「{CHALLENGE_TEXT}」<input value={typed} onChange={e=>setTyped(e.target.value)}/></label></>:<p>确定结束这段专注吗？</p>}{error&&<p role="alert">{error}</p>}<div className="modal-actions"><button onClick={close}>继续专注</button>{s.mode!=='strict'&&<button className="button primary" disabled={busy||!can} onClick={()=>{setBusy(true);void run('focus_cancel',{id,reason,typed}).then(close).catch(e=>setError(String(e))).finally(()=>setBusy(false));}}>确认结束</button>}</div></section></div>;
}
