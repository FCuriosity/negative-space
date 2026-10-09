import {useState} from 'react';
import {Check,CheckSquare,Plus,Pencil,Trash2,X} from 'lucide-react';
import {dayKey,type AppState,type Task} from '../../../packages/core/src';
import {addDailyTask,editDailyTask,tasksForDay,updateDailyTasks} from '../../../packages/core/src/tasks';
import './daily-tasks.css';
type Change=(fn:(state:AppState)=>AppState)=>void;
export function DailyTasks({state,change,now,compact=false,onHistory}:{state:AppState;change:Change;now:number;compact?:boolean;onHistory?:()=>void}){
 const today=dayKey(now,state.settings.timezone);
 return <DailyTaskList key={today} state={state} change={change} today={today} compact={compact} onHistory={onHistory}/>;
}
function DailyTaskList({state,change,today,compact,onHistory}:{state:AppState;change:Change;today:string;compact:boolean;onHistory?:()=>void}){
 const [title,setTitle]=useState(''),[project,setProject]=useState(state.projects[0]?.id??'personal'),[selecting,setSelecting]=useState(false),[selected,setSelected]=useState<string[]>([]),[editing,setEditing]=useState<string|null>(null),[draft,setDraft]=useState(''),[editProject,setEditProject]=useState(project);
 const tasks=tasksForDay(state,today),removed=tasksForDay(state,today,true).filter(t=>t.deletedAt!==undefined),picked=selected.filter(id=>tasks.some(t=>t.id===id));
 const update=(ids:string[],action:'complete'|'reopen'|'remove'|'restore')=>{change(s=>updateDailyTasks(s,ids,action,Date.now()));setSelected([]);};
 const edit=(task:Task)=>{setEditing(task.id);setDraft(task.title);setEditProject(task.projectId);};
 return <div className={`daily-tasks ${compact?'compact':''}`}>
  <div className="daily-task-heading"><span>{today.slice(5).replace('-',' / ')} · {tasks.filter(t=>t.done).length} / {tasks.length} 已完成</span><button className="text-button" aria-pressed={selecting} onClick={()=>{setSelecting(!selecting);setSelected([]);setEditing(null);}}><CheckSquare size={14}/>{selecting?'退出多选':'多选'}</button></div>
  {selecting&&<div className="daily-task-batch"><label><input type="checkbox" aria-label="全选今日事项" checked={tasks.length>0&&picked.length===tasks.length} onChange={e=>setSelected(e.target.checked?tasks.map(t=>t.id):[])}/>全选</label><span>已选 {picked.length} 项</span><button disabled={!picked.length} onClick={()=>update(picked,'complete')}>完成</button><button disabled={!picked.length} onClick={()=>update(picked,'reopen')}>未完成</button><button disabled={!picked.length} className="danger" onClick={()=>update(picked,'remove')}>删除</button></div>}
  <div className="daily-task-list">{tasks.map(task=><div className={`daily-task-row ${task.done?'is-done':''}`} key={task.id}>
   {editing===task.id?<form className="daily-task-edit" onSubmit={e=>{e.preventDefault();if(draft.trim()){change(s=>editDailyTask(s,task.id,draft,editProject,Date.now()));setEditing(null);}}}><input autoFocus aria-label="编辑事项名称" value={draft} maxLength={100} required onChange={e=>setDraft(e.target.value)}/><select aria-label="编辑事项项目" value={editProject} onChange={e=>setEditProject(e.target.value)}>{state.projects.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select><button className="icon-button" disabled={!draft.trim()} aria-label="保存事项修改"><Check size={16}/></button><button className="icon-button" type="button" aria-label="取消事项修改" onClick={()=>setEditing(null)}><X size={16}/></button></form>:<>
   <input type="checkbox" aria-label={selecting?`选择事项${task.title}`:`完成事项${task.title}`} checked={selecting?picked.includes(task.id):task.done} onChange={e=>selecting?setSelected(e.target.checked?[...picked,task.id]:picked.filter(id=>id!==task.id)):update([task.id],e.target.checked?'complete':'reopen')}/>
   <div className="daily-task-text"><strong>{task.title}</strong>{!compact&&<small>{state.projects.find(p=>p.id===task.projectId)?.name??'原项目已移除'}{task.carriedFrom?' · 从历史续做':''}</small>}</div>
   {!selecting&&<><button className="icon-button" aria-label={`编辑事项${task.title}`} onClick={()=>edit(task)}><Pencil size={14}/></button><button className="icon-button" aria-label={`删除事项${task.title}`} onClick={()=>update([task.id],'remove')}><Trash2 size={14}/></button></>}
   </>}
  </div>)}</div>
  {!tasks.length&&<p className="daily-task-empty">今天还没有安排，写下想完成的一件事</p>}
  <form className="daily-task-add" onSubmit={e=>{e.preventDefault();if(title.trim()){const id=crypto.randomUUID();change(s=>addDailyTask(s,id,title,project,Date.now()));setTitle('');}}}><input aria-label={compact?'今天最重要的一件事':'新事项名称'} placeholder="添加今日事项" value={title} maxLength={100} required onChange={e=>setTitle(e.target.value)}/>{!compact&&<select aria-label="事项归属项目" value={project} onChange={e=>setProject(e.target.value)}>{state.projects.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select>}<button className="button secondary" aria-label="添加今日事项" disabled={!title.trim()}><Plus size={16}/></button></form>
  {removed.length>0&&<details className="daily-task-removed"><summary>今日已删除 {removed.length} 项 · 可恢复</summary>{removed.map(task=><div key={task.id}><span>{task.title}</span><button className="text-button" onClick={()=>update([task.id],'restore')}>恢复</button></div>)}</details>}
  <div className="daily-task-foot"><span>零点换新一天，昨日自动留存</span>{onHistory&&<button className="text-button" onClick={onHistory}>回看每日事项</button>}</div>
 </div>;
}
