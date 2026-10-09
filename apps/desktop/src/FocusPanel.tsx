import {useState} from 'react';
import {ArrowRight,Check,Expand,LockKeyhole} from 'lucide-react';
import {isOpenEnded,modeLabels,validFocusMinutes,type AppState,type FocusSession,type Mode} from '../../../packages/core/src';
import {SpaceLandscape} from './FocusSpaces';
import {FocusBackgroundPicker,FocusPhoto} from './FocusBackground';
type Change=(fn:(s:AppState)=>AppState)=>void;
const clock=(seconds:number)=>`${Math.floor(seconds/60).toString().padStart(2,'0')}:${Math.floor(seconds%60).toString().padStart(2,'0')}`;
export function FocusPanel({active,now,state,change,start,onCancel,onFinish,finishing,onExpand}:{active?:FocusSession;now:number;state:AppState;change:Change;start:(minutes:number,mode:Mode,project:string,lists:string[],timerMode:'countdown'|'countup')=>void;onCancel:()=>void;onFinish:()=>void;finishing:boolean;onExpand:()=>void}){
 const [preset,setPreset]=useState(state.settings.focusDurationMinutes),[custom,setCustom]=useState(![25,50,60].includes(state.settings.focusDurationMinutes)),[customText,setCustomText]=useState(String(state.settings.focusDurationMinutes));
 const [mode,setMode]=useState<Mode>('friction'),[project,setProject]=useState('personal'),[lists,setLists]=useState(['entertainment']);
 const timerMode=state.settings.focusTimerMode??'countdown',countup=(active?(active.timerMode??'countdown'):timerMode)==='countup';
 const minutes=custom?Number(customText):preset,validDuration=validFocusMinutes(minutes),openEnded=active&&isOpenEnded(active);
 const tone=active?.spaceTone??state.settings.focusTone??'mint',backgroundId=active?active.backgroundId:state.settings.focusBackgroundId;
 const seconds=active?Math.max(0,(countup?now-active.startedAt:active.endsAt-now)/1000):countup?0:validDuration?minutes*60:0;
 return <article className={`focus-card focus-tone-${tone}`}><SpaceLandscape tone={tone}/><FocusPhoto state={state} backgroundId={backgroundId}/>
  <div className="focus-top"><span><span className="live-dot"/>{active?'专注进行中':'开启一段专注'}</span><button className="icon-button" aria-label="全屏专注" onClick={onExpand}><Expand size={17}/></button></div>
  <div className="focus-body"><div><div className="focus-label">{active?`${active.spaceName??'专注'} · ${countup?'正向计时':modeLabels[active.mode]}`:'把这段时间，留给一件事'}</div><div className="timer-digits" aria-label="专注计时">{clock(seconds)}<span>{countup?'已专注 · 分钟 : 秒':'剩余 · 分钟 : 秒'}</span></div></div><div className="focus-seal" aria-hidden="true"><span>一事</span><span>一时</span></div></div>
  {!active?<><div className="timer-kind" role="group" aria-label="计时方式">{(['countdown','countup'] as const).map(kind=><button key={kind} aria-pressed={timerMode===kind} onClick={()=>{change(s=>({...s,settings:{...s.settings,focusTimerMode:kind}}));if(kind==='countup'&&mode==='strict')setMode('friction');}}>{kind==='countup'?'正向计时':'倒计时'}<small>{kind==='countup'?'从零开始，手动完成':'设定时长，到时完成'}</small></button>)}</div>
  <div className="focus-options">{!countup&&<div className="duration-pills" aria-label="专注时长">{[25,50,60].map(m=><button key={m} aria-pressed={!custom&&preset===m} className={!custom&&preset===m?'active':''} onClick={()=>{setPreset(m);setCustom(false);}}>{m} 分钟</button>)}<button aria-pressed={custom} className={custom?'active':''} onClick={()=>setCustom(true)}>自定义</button></div>}<select aria-label="专注项目" value={project} onChange={e=>setProject(e.target.value)}>{state.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
  {!countup&&custom&&<div className="custom-duration"><label>自定义专注时长<div><input aria-label="自定义专注时长（分钟）" aria-invalid={!validDuration} type="number" min={1} max={720} step={1} value={customText} onChange={e=>setCustomText(e.target.value)}/><span>分钟</span></div></label><p className={validDuration?'small muted':'error-text'}>{validDuration?'1–720 分钟；开始后会记住这次时长':'请输入 1–720 之间的整数分钟'}</p></div>}
  <div className="focus-options"><select aria-label="专注自律等级" value={mode} onChange={e=>setMode(e.target.value as Mode)}><option value="gentle">温和提醒</option><option value="friction">输入挑战解除</option><option value="strict" disabled={countup}>严格计时（不可提前结束）</option></select><div className="list-checks">{state.lists.map(l=><label key={l.id}><input type="checkbox" checked={lists.includes(l.id)} onChange={e=>setLists(e.target.checked?[...lists,l.id]:lists.filter(id=>id!==l.id))}/>{l.name}</label>)}</div></div>
  <details className="focus-background-settings"><summary>选择专注背景<span>{backgroundId?'本机图片':'柔和配色'}</span></summary><FocusBackgroundPicker state={state} tone={tone} backgroundId={backgroundId} onChange={(focusTone,focusBackgroundId)=>change(s=>({...s,settings:{...s.settings,focusTone,focusBackgroundId}}))} onImport={asset=>change(s=>({...s,focusBackgrounds:[...s.focusBackgrounds,asset]}))}/></details>
  {countup&&<p className="timer-note">从 00:00 开始累计，完成时记录实际时长满 1 分钟收获一颗星；不足 1 分钟也会留下记录</p>}
  <button className="button focus-start" disabled={!countup&&!validDuration} onClick={()=>start(validDuration?minutes:25,mode,project,lists,timerMode)}><span>{countup?'开始正向专注':'开始专注'}</span><ArrowRight size={18}/></button></>:<>
  {!openEnded&&<div className="session-progress"><span style={{width:`${Math.max(0,Math.min(100,(now-active.startedAt)/(active.endsAt-active.startedAt)*100))}%`}}/></div>}
  <div className="active-caption">正在为「{state.projects.find(p=>p.id===active.projectId)?.name}」留出时间{countup&&<p className="timer-note">{openEnded?'按自己的节奏，完成后写下这次心得':`按时间表预留 ${active.durationMinutes} 分钟，到时自动完成`}</p>}</div>
  <button className="button focus-start" disabled={finishing} onClick={openEnded?onFinish:onCancel}><span>{finishing?'正在保存…':openEnded?'完成专注':active.mode==='strict'?'查看专注约定':'提前结束'}</span>{openEnded?<Check size={18}/>:<LockKeyhole size={17}/>}</button>
  {openEnded&&seconds<60&&<p className="timer-note">不足 1 分钟会保存为短暂尝试，不增加星星与奖励</p>}
  </>}
 </article>;
}
