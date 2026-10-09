import { OpeningIntention } from './OpeningIntention';
import { useState, type ReactNode } from 'react';
import { BookOpen, MessageSquare, PencilLine, Clock3, ArrowUpRight, ChevronRight, X } from 'lucide-react';
import type { AppState, FocusSession, OpenEvent } from '../../../packages/core/src';
import { dayKey, reasonLabels } from '../../../packages/core/src';
import { journalCounts, sessionEndedAt } from '../../../packages/core/src/journal';
import { buildJournalCalendar, recentCalendarDays, type JournalCalendarNode } from '../../../packages/core/src/journal-calendar';
import { ReasonTags } from './ReasonTags';
const stamp=(at:number,tz:string)=>new Intl.DateTimeFormat('zh-CN',{timeZone:tz,month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(at);
const elapsed=(state:AppState,s:FocusSession)=>{const seconds=Math.max(0,Math.floor((sessionEndedAt(state,s)-s.startedAt)/1000));return `${Math.floor(seconds/60)} 分 ${seconds%60} 秒`;};

function CalendarGroup<T>({node,renderItem,summarize}:{node:JournalCalendarNode<T>;renderItem:(item:T)=>ReactNode;summarize:(items:T[])=>string}) {
  const [expanded,setExpanded]=useState(!node.closed);
  const [limit,setLimit]=useState(20);
  return <section className={`journal-calendar-node calendar-${node.kind}`}>
    <button className="journal-calendar-toggle" type="button" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>
      <ChevronRight size={16} className={expanded?'expanded':''}/><span className="calendar-kind">{node.kind==='month'?'月':node.kind==='week'?'周':'日'}</span>
      <span className="calendar-caption"><strong>{node.title}</strong><small>{summarize(node.items)}</small></span><span className="calendar-action">{expanded?'收起':'展开'}</span>
    </button>
    {expanded&&<div className="journal-calendar-content">{node.children.length?node.children.map(child=><CalendarGroup key={`${child.key}:${child.closed}`} node={child} renderItem={renderItem} summarize={summarize}/>):<div className="journal-timeline">{node.items.slice(0,limit).map(renderItem)}{node.items.length>limit&&<button className="button secondary journal-more" onClick={()=>setLimit(n=>n+20)}>继续查看当天记录（还剩 {node.items.length-limit} 条）</button>}</div>}</div>}
  </section>;
}
function CalendarTimeline<T>({items,at,now,tz,renderItem,summarize}:{items:T[];at:(item:T)=>number;now:number;tz:string;renderItem:(item:T)=>ReactNode;summarize:(items:T[])=>string}) {
  return <div className="journal-calendar">{buildJournalCalendar(items,at,now,tz).map(node=><CalendarGroup key={`${tz}:${node.key}:${node.closed}`} node={node} renderItem={renderItem} summarize={summarize}/>)}</div>;
}
export function Journal({state,now,onReflection,onReason}:{state:AppState;now:number;onReflection:(id:string)=>void;onReason:(id:string)=>void}) {
  const [range,setRange]=useState('all');
  const [target,setTarget]=useState('all');
  const tz=state.settings.timezone;
  const allDays=[...state.sessions.filter(s=>s.status!=='active').map(s=>dayKey(sessionEndedAt(state,s),tz)),...state.opens.map(o=>dayKey(o.at,tz)),...state.openReasons.map(r=>dayKey(r.at,tz))];
  const days=range==='all'?[...new Set(allDays)]:recentCalendarDays(now,tz,Number(range));
  const counts=journalCounts(state,days,target);
  const sessions=counts.sessions;
  const entries=[...counts.opens.map(event=>({id:event.id,at:event.at,event,override:undefined})),...counts.overrides.map(override=>({id:override.id,at:override.at,event:undefined,override}))];
  const appTargets=state.targets.filter(t=>t.kind==='app');
  return <div className="journal">
    <div className="journal-toolbar"><p>把每一次投入、每一次打开，都留下一点记忆</p><label>查看范围<select aria-label="历历在目时间范围" value={range} onChange={e=>setRange(e.target.value)}><option value="1">今天</option><option value="7">最近 7 天</option><option value="30">最近 30 天</option><option value="all">全部保留记录</option></select></label></div>
    <p className="journal-calendar-help">今天展开，过去按日收起；周一收起上一周，月初收起上个月点击节点可逐层回看<span>周一至周日 · 跨月周按月份拆分 · 仅显示所选范围内的记录 · 当前保留 {state.settings.retentionDays} 天</span></p>
    <section className="journal-stats" aria-label="次数统计"><div><span>完成专注</span><strong>{counts.completed}<small>次</small></strong></div><div><span>留下心得</span><strong>{counts.reflections.length}<small>篇</small></strong></div><div><span>打开 App</span><strong>{counts.opens.length}<small>次</small></strong></div><div><span>临时放行</span><strong>{counts.overrides.length}<small>次</small></strong></div></section>
    <div className="journal-columns"><section className="journal-column"><div className="journal-column-heading"><div className="journal-icon"><BookOpen size={21}/></div><div><h2>专注心得</h2><p>专注结束时，给这段时间写个注脚</p></div><span className="journal-total">{sessions.length} 次结束</span></div>
      {sessions.length?<CalendarTimeline key={`focus:${range}`} items={sessions} at={session=>sessionEndedAt(state,session)} now={now} tz={tz} summarize={items=>`${items.filter(s=>s.status==='completed').length} 次完成 · ${items.filter(s=>s.status==='cancelled').length} 次提前结束 · ${state.reflections.filter(r=>items.some(s=>s.id===r.sessionId)).length} 篇心得`} renderItem={session=>{
        const ended=sessionEndedAt(state,session),reflection=state.reflections.find(r=>r.sessionId===session.id),project=state.projects.find(p=>p.id===session.projectId);
        return <article className="journal-entry" key={session.id}><div className="journal-entry-body"><div className="journal-entry-meta"><time dateTime={new Date(ended).toISOString()}>{stamp(ended,tz)}</time><span className={`journal-pill ${session.status==='cancelled'?'cancelled':''}`}>{session.status==='completed'?'已完成':session.timerMode==='countup'&&session.durationMinutes<1?'短暂尝试':'提前结束'}</span></div><h3>{session.spaceName??project?.name??'专注'} · {elapsed(state,session)}</h3>{reflection?<p className="journal-prose">{reflection.text}</p>:<p className="journal-unwritten">这一段专注，还没有留下心得</p>}<button className="text-button" onClick={()=>onReflection(session.id)}><PencilLine size={14}/>{reflection?'修改心得':'补写心得'}</button></div></article>;
      }}/>:<div className="journal-empty"><BookOpen size={30}/><h3>让第一段专注，有迹可循</h3><p>结束专注后会邀请你写下心得，<br/>也可以稍后回到这里补写</p></div>}
    </section><section className="journal-column"><div className="journal-column-heading"><div className="journal-icon rose"><MessageSquare size={21}/></div><div><h2>打开 App 的理由</h2><p>打开之前，想一想这次为了什么</p></div></div>
      <div className="journal-app-filter"><label>应用<select aria-label="打开理由应用筛选" value={target} onChange={e=>setTarget(e.target.value)}><option value="all">全部应用</option>{appTargets.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><div className="journal-app-counts">{appTargets.filter(t=>target==='all'||target===t.id).map(t=><span key={t.id}>{t.name} <b>{counts.opens.filter(o=>o.targetId===t.id).length}</b> 次</span>)}</div></div>
      <p className="journal-count-help">每次从其他应用切回算 1 次留白提醒后的返回不重复计数；临时放行单独统计旧版启动记录保留原标记</p>
      {entries.length?<CalendarTimeline key={`opens:${range}:${target}`} items={entries} at={entry=>entry.at} now={now} tz={tz} summarize={items=>`${items.filter(e=>e.event).length} 次打开 · ${items.filter(e=>e.override).length} 次放行`} renderItem={entry=>{
        const targetId=entry.event?.targetId??entry.override!.targetId,app=state.targets.find(t=>t.id===targetId),reason=entry.override??state.openReasons.find(r=>r.eventId===entry.event?.id&&r.source==='open');
        return <article className="journal-entry" key={entry.id}><div className="journal-entry-body"><div className="journal-entry-meta"><time dateTime={new Date(entry.at).toISOString()}>{stamp(entry.at,tz)}</time><span className={`journal-pill ${entry.override?'cancelled':''}`}>{entry.override?`放行 ${entry.override.grantedMinutes??5} 分钟`:entry.event?.kind==='launch'?'旧版启动记录':'切回应用'}</span></div><h3><span className="journal-app-dot" style={{background:app?.color}}/>{app?.name??'应用'}</h3>{entry.event?.outsideAllowedWindow&&<p className="small muted">允许时段外打开 · {entry.event.intention==='accidental'?'无意识 · 已记入镜湖':entry.event.intention==='intentional'?'有明确目的':'待确认意图'}</p>}{reason?.text?<p className="journal-prose">{reason.text}</p>:<p className="journal-unwritten">这次还没有填写打开理由</p>}{entry.override?<p className="small muted"><ArrowUpRight size={12}/> {entry.override.restriction?reasonLabels[entry.override.restriction]:'临时继续使用'}</p>:<button className="text-button" onClick={()=>onReason(entry.event!.id)}><PencilLine size={14}/>{reason?'修改理由':'补写理由'}</button>}</div></article>;
      }}/>:<div className="journal-empty"><MessageSquare size={30}/><h3>每次打开，都带着一点目的</h3><p>在 Mac 应用中开启管理后，<br/>切回受管理的 App 会记录次数并邀请填写理由</p></div>}
    </section></div>
  </div>;
}
export function ReflectionDialog({state,session,onClose,onSave}:{state:AppState;session:FocusSession;onClose:()=>void;onSave:(text:string)=>Promise<void>}) {
  const existing=state.reflections.find(r=>r.sessionId===session.id);
  const [text,setText]=useState(existing?.text??'');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  return <div className="modal-backdrop"><section className="modal narrow journal-dialog" role="dialog" aria-modal="true" aria-labelledby="reflection-title"><div className="modal-heading"><div><span className="eyebrow">留给自己的几句话</span><h2 id="reflection-title">这一段专注，有什么心得？</h2></div><button className="icon-button" aria-label="稍后写心得" disabled={busy} onClick={onClose}><X/></button></div><p className="journal-dialog-meta"><Clock3 size={15}/>{elapsed(state,session)} · {session.status==='completed'?'专注完成':session.timerMode==='countup'&&session.durationMinutes<1?'短暂尝试':'提前结束'} · {stamp(sessionEndedAt(state,session),state.settings.timezone)}</p><form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await onSave(text);}catch(e){setError(String(e));}finally{setBusy(false);}}}><label>专注心得<textarea autoFocus aria-label="专注心得" rows={6} maxLength={2000} value={text} onChange={e=>setText(e.target.value)} placeholder="完成了什么？哪里遇到了困难？下一次想怎样开始？"/></label><div className="journal-writing-meta"><span>将保存在「历历在目」的专注时间线上</span><span>{text.length} / 2000</span></div>{error&&<p className="error-text" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>稍后补写</button><button className="button primary" disabled={busy||!text.trim()}>{busy?'保存中…':'保存心得'}</button></div></form></section></div>;
}
export function OpenReasonDialog({state,event,prompt,onClose,onSave,onSaveTags}:{state:AppState;event:OpenEvent;prompt:boolean;onClose:()=>Promise<void>;onSave:(text:string,intention?:string)=>Promise<void>;onSaveTags:(tags:string[])=>Promise<void>}) {
  const [text,setText]=useState(state.openReasons.find(r=>r.eventId===event.id && r.source==='open')?.text??'');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const [intention,setIntention]=useState(event.intention==='pending'?'':event.intention??'');
  const needsReview=!!event.outsideAllowedWindow;
  const target=state.targets.find(t=>t.id===event.targetId);const today=dayKey(event.at,state.settings.timezone);const count=state.opens.filter(o=>o.targetId===event.targetId&&o.at<=event.at&&dayKey(o.at,state.settings.timezone)===today).length;
  const run=async(fn:()=>Promise<void>)=>{setBusy(true);setError('');try{await fn();}catch(e){setError(String(e));}finally{setBusy(false);}};
  return <div className="modal-backdrop"><section className="modal narrow journal-dialog" role="dialog" aria-modal="true" aria-labelledby="open-reason-title"><span className="eyebrow">一次打开，一个理由</span><h2 id="open-reason-title">这次打开{target?.name??' App'}，想做什么？</h2><p>{stamp(event.at,state.settings.timezone)} · 当天第 <strong>{count}</strong> 次打开</p><p className="small muted">{needsReview?'这次打开不在允许使用时段内，请填写理由并确认意图':''}</p><form onSubmit={e=>{e.preventDefault();void run(()=>onSave(text,needsReview?intention:undefined));}}><ReasonTags tags={state.settings.reasonTags} text={text} onText={setText} onSave={onSaveTags} disabled={busy}/><label>打开 App 的理由<textarea autoFocus aria-label="打开 App 的理由" rows={4} maxLength={300} value={text} onChange={e=>setText(e.target.value)} placeholder="例如：看完收藏的课程，或回复一条必要的消息"/></label><>{needsReview&&<OpeningIntention value={intention} onChange={setIntention} disabled={busy}/>}</><div className="journal-writing-meta"><span>记录在「历历在目」，不会增加打开次数</span><span>{text.length} / 300</span></div>{error&&<p className="error-text" role="alert">{error}</p>}<div className="modal-actions">{(!prompt||!needsReview)&&<button type="button" className="button secondary" disabled={busy} onClick={()=>void run(onClose)}>{prompt?'稍后补写，返回应用':'取消'}</button>}<button className="button primary" disabled={busy||!text.trim()||(needsReview&&!intention)}>{busy?'保存中…':needsReview&&intention==='accidental'?'记录到镜湖':prompt?'记录理由，返回应用':'保存理由'}</button></div></form></section></div>;
}
