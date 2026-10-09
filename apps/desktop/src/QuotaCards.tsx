import { useState } from 'react';
import { Clock3, MousePointer2, MoreHorizontal, Sparkles } from 'lucide-react';
import { modeLabels, type AppState, type Rule } from '../../../packages/core/src';
import { dailyQuota } from '../../../packages/core/src/quota';
const duration=(seconds:number,roundUp=false)=>{const n=Math.max(0,roundUp?Math.ceil(seconds):Math.floor(seconds));return `${Math.floor(n/60)} 分 ${n%60} 秒`;};
const clock=(minute:number)=>`${Math.floor(minute/60).toString().padStart(2,'0')}:${(minute%60).toString().padStart(2,'0')}`;
// Keep app identity, but use a curated, opaque pastel palette for the water.
function waterTone(color:string) {
  const hex=color.replace('#','');
  if(!/^[\da-f]{6}$/i.test(hex))return 'lavender';
  const [r,g,b]=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255);
  const max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;
  if(delta<.08)return 'lavender';
  const hue=((max===r?(g-b)/delta:max===g?(b-r)/delta+2:(r-g)/delta+4)*60+360)%360;
  return hue<65?'peach':hue<175?'mint':hue<265?'blue':hue<315?'lavender':'rose';
}
function LiquidQuota({ratio,basis,name,color}:{ratio:number|null;basis:string;name:string;color:string}) {
  const percent=ratio===null?null:ratio*100;
  const text=percent===null?'不限':`${Math.floor((percent+1e-8)*10)/10}`;
  return <div className={`quota-vessel water-${waterTone(color)} ${ratio===0?'empty':''} ${ratio===null?'unlimited':''}`} role={ratio===null?'img':'meter'} aria-label={`${name}${basis==='time'?'剩余时间':basis==='opens'?'剩余次数':'未设置每日配额'}`} aria-valuemin={ratio===null?undefined:0} aria-valuemax={ratio===null?undefined:100} aria-valuenow={percent??undefined} aria-valuetext={percent===null?undefined:`剩余 ${text}%`}>
    <div className="quota-ticks" aria-hidden="true"><span>100</span><span>50</span><span>0</span></div>
    {percent!==null&&percent>0&&<div className="quota-liquid" data-testid="quota-liquid" style={{height:`${percent}%`}} aria-hidden="true">{['far','middle','near'].map(layer=><div className={`quota-water quota-water-${layer}`} key={layer}><svg className="quota-wave" viewBox="0 0 600 24" preserveAspectRatio="none"><path d="M0 12 C50 2 100 2 150 12 S250 22 300 12 S400 2 450 12 S550 22 600 12 V24 H0Z"/></svg></div>)}</div>}
    <div className="quota-level-label" aria-hidden="true"><span>{basis==='time'?'时间还剩':basis==='opens'?'次数还剩':'自由安排'}</span><strong>{text}{percent!==null&&<small>%</small>}</strong><i>{ratio===0?'今日额度已用完':ratio===null?'未设置每日上限':'把余量留给想做的事'}</i></div>
  </div>;
}
export function QuotaCards({state,now,compact=false,onEdit,onToggle,tracking,browserConnected=false}:{state:AppState;now:number;compact?:boolean;onEdit:(rule:Rule)=>void;onToggle:(rule:Rule)=>void;browserConnected?:boolean;tracking:'active'|'paused'|'preview'}) {
  const [filter,setFilter]=useState('all');
  const visible=state.rules.filter(r=>filter==='all'||state.targets.find(t=>t.id===r.targetId)?.kind===filter);
  return <><div className="quota-toolbar"><div className="segmented" aria-label="配额类型">{[{id:'all',label:'全部'},{id:'app',label:'电脑应用'},{id:'website',label:'网站'}].map(item=><button key={item.id} aria-pressed={filter===item.id} onClick={()=>setFilter(item.id)}>{item.label}<span>{state.rules.filter(r=>item.id==='all'||state.targets.find(t=>t.id===r.targetId)?.kind===item.id).length}</span></button>)}</div><span className="quota-reset">每日 00:00 重置</span></div><div className={`quota-grid ${compact?'quota-compact':''}`}>{visible.map(rule=>{
    const target=state.targets.find(t=>t.id===rule.targetId);
    if(!target)return null;
    const q=dailyQuota(state,rule,now);
    const title=q.basis==='time'?`今日 ${q.limits.dailyMinutes} 分钟` : q.basis==='opens'?`今日最多 ${q.limits.dailyOpens} 次`:'今日不限额';
    const remaining=q.remainingSeconds!==null?`还可使用 ${duration(q.remainingSeconds,true)}`:q.remainingOpens!==null?`还可打开 ${q.remainingOpens} 次`:'按自己的节奏使用';
    return <article className={`quota-card ${!rule.enabled?'quota-paused':''}`} key={rule.id} aria-label={`${target.name}每日配额`}><div className="quota-card-heading"><span className="app-icon" style={{background:`${target.color}24`,color:'#273e3f'}}>{target.initials}</span><div><h3>{target.name}</h3><p>{target.kind==='app'?'电脑应用':'网站'} · {title}</p></div><button className="quota-edit" aria-label={`编辑${target.name}规则`} onClick={()=>onEdit(rule)}>编辑</button></div><LiquidQuota ratio={q.ratio} basis={q.basis} name={target.name} color={target.color}/><div className="quota-remaining"><strong>{remaining}</strong>{q.totalSeconds!==null&&q.bonusMinutes>0?<span><Sparkles size={11}/>含奖励 {q.bonusMinutes} 分钟</span>:<span>{!rule.enabled?'规则已暂停':q.basis==='time'?'液面随剩余时间下降':q.basis==='opens'?'液面按剩余次数计算':'没有上限时不显示百分比'}</span>}</div><div className="quota-stats"><div><span><Clock3 size={12}/>今日已用</span><strong>{duration(q.usedSeconds)}</strong>{q.totalSeconds!==null&&<small>额度 {q.totalSeconds/60} 分钟</small>}</div><div><span><MousePointer2 size={12}/>今日打开</span><strong>{q.opens}<em> 次</em></strong><small>{q.limits.dailyOpens===null?'次数不限':`上限 ${q.limits.dailyOpens} 次 · 剩余 ${q.remainingOpens} 次`}</small></div></div><div className="quota-card-foot"><span className={`mode-tag ${rule.mode}`}>{modeLabels[rule.mode]}</span><span className={`quota-tracking ${tracking==='active'&&(target.kind==='app'||browserConnected)?'active':'inactive'}`}>{tracking==='preview'?'网页预览':tracking==='active'?(target.kind==='website'&&!browserConnected?'扩展未连接':'统计中'):'统计已暂停'}</span>{!compact&&<button type="button" className={`toggle ${rule.enabled?'on':''}`} role="switch" aria-checked={rule.enabled} aria-label={`启用${target.name}规则`} onClick={()=>onToggle(rule)}><span/></button>}</div>{q.remainingSeconds!==null&&q.remainingOpens===0&&<p className="quota-warning">次数额度已用完，下次打开将触发提醒</p>}{rule.allowedWindows.length>0&&<p className="quota-detail">可用时段 {rule.allowedWindows.map(w=>`${w.days.length===7?'每天':w.days.map(d=>'周'+['日','一','二','三','四','五','六'][d]).join('、')} ${clock(w.start)}—${w.end<w.start?'次日 ':''}${clock(w.end)}`).join('、')}</p>}{!compact&&<p className="quota-detail">{rule.breakEveryMinutes?`每使用 ${rule.breakEveryMinutes} 分钟，休息 ${rule.breakMinutes} 分钟`:'关闭前提醒保存工作'}</p>}</article>;
  })}{!visible.length&&<div className="empty quota-empty"><p>还没有这一类规则</p><small>点击页面上方的「添加规则」开始设置</small></div>}</div></>;
}
