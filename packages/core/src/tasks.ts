import type {AppState,Task} from './model';
import {dayKey} from './time';

/** Old tasks have no trustworthy creation date; adopt them once on the upgrade day. */
export function migrateTasks(tasks:Task[],now:number,timezone:string):Task[]{
 const today=dayKey(now,timezone);
 return tasks.map(task=>task.day?task:{...task,day:today,createdAt:now,legacyImported:true});
}
export function tasksForDay(state:AppState,day:string,includeDeleted=false){
 return state.tasks.filter(task=>task.day===day&&(includeDeleted||task.deletedAt===undefined));
}
function titleValue(title:string){const value=title.trim();if(!value||value.length>100)throw new Error('事项名称请填写 1–100 个字');return value;}
export function addDailyTask(state:AppState,id:string,title:string,projectId:string,now:number):AppState{
 if(state.tasks.some(t=>t.id===id))return state;
 if(!state.projects.some(p=>p.id===projectId))throw new Error('请选择现有项目');
 return {...state,tasks:[...state.tasks,{id,title:titleValue(title),projectId,done:false,day:dayKey(now,state.settings.timezone),createdAt:now}]};
}
export function editDailyTask(state:AppState,id:string,title:string,projectId:string,now:number):AppState{
 const today=dayKey(now,state.settings.timezone),value=titleValue(title);
 if(!state.projects.some(p=>p.id===projectId))throw new Error('请选择现有项目');
 return {...state,tasks:state.tasks.map(t=>t.id===id&&t.day===today&&t.deletedAt===undefined?{...t,title:value,projectId}:t)};
}
export function updateDailyTasks(state:AppState,ids:string[],action:'complete'|'reopen'|'remove'|'restore',now:number):AppState{
 const today=dayKey(now,state.settings.timezone),selected=new Set(ids);
 return {...state,tasks:state.tasks.map(task=>{
  if(!selected.has(task.id)||task.day!==today)return task;
  if(action==='restore')return {...task,deletedAt:undefined};
  if(task.deletedAt!==undefined)return task;
  if(action==='remove')return {...task,deletedAt:now};
  return {...task,done:action==='complete',completedAt:action==='complete'?(task.completedAt??now):undefined};
 })};
}
/** Copy into today without rewriting yesterday's title or completion state. */
export function carryDailyTask(state:AppState,sourceId:string,id:string,now:number):AppState{
 const today=dayKey(now,state.settings.timezone),source=state.tasks.find(t=>t.id===sourceId);
 if(!source?.day||source.day>=today||source.done||source.deletedAt!==undefined)return state;
 const existing=state.tasks.find(t=>t.day===today&&t.carriedFrom===sourceId);
 if(existing)return existing.deletedAt===undefined?state:updateDailyTasks(state,[existing.id],'restore',now);
 const next=addDailyTask(state,id,source.title,state.projects.some(p=>p.id===source.projectId)?source.projectId:state.projects[0].id,now);
 return {...next,tasks:next.tasks.map(t=>t.id===id?{...t,carriedFrom:sourceId}:t)};
}
