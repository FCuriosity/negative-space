import {describe,it,expect} from 'vitest';
import {initialState} from '../src/seed';
import {parseState,pruneHistory} from '../src/state';
import {addDailyTask,editDailyTask,updateDailyTasks,tasksForDay,carryDailyTask} from '../src/tasks';
import {buildJournalCalendar} from '../src/journal-calendar';
import {NativeEngine} from '../src/native-engine';
const before=Date.parse('2026-10-09T23:59:59+08:00'),after=before+2000;
const start=()=>addDailyTask(initialState(),'one','阅读一章','personal',before);
describe('daily tasks and archived intentions',()=>{
 it('changes the visible day at local midnight without discarding yesterday or requiring the app to run',()=>{
  const state=updateDailyTasks(start(),['one'],'complete',before);
  const restored=parseState(JSON.parse(JSON.stringify(state)),after);
  expect(tasksForDay(restored,'2026-10-10')).toHaveLength(0);expect(tasksForDay(restored,'2026-10-09')[0]).toMatchObject({done:true,completedAt:before});
  const next=addDailyTask(restored,'two','写作','personal',after);expect(tasksForDay(next,'2026-10-10')).toHaveLength(1);expect(next.tasks).toHaveLength(2);
 });
 it('uses configured timezone for dates, not UTC or the host calendar',()=>{
  const state=initialState();state.settings.timezone='America/Los_Angeles';
  expect(addDailyTask(state,'x','整理','personal',after).tasks[0].day).toBe('2026-10-09');
 });
 it('migrates legacy tasks exactly once and keeps their text and status',()=>{
  const raw=initialState();raw.tasks=[{id:'old',title:'已有内容。保留标点','projectId':'personal',done:true}];
  const migrated=parseState(raw,before);expect(migrated.tasks[0]).toMatchObject({day:'2026-10-09',done:true,legacyImported:true,title:'已有内容。保留标点'});
  expect(parseState(JSON.parse(JSON.stringify(migrated)),after).tasks).toEqual(migrated.tasks);
 });
 it('edits and performs batch actions for today only, with recoverable deletion',()=>{
  let state=addDailyTask(start(),'two','写文章','work',before);state=editDailyTask(state,'one','阅读两章','study',before);
  expect(state.tasks[0]).toMatchObject({title:'阅读两章',projectId:'study'});
  state=updateDailyTasks(state,['one','two'],'complete',before);expect(state.tasks.every(t=>t.done)).toBe(true);
  state=updateDailyTasks(state,['one'],'reopen',before);expect(state.tasks[0].completedAt).toBeUndefined();
  state=updateDailyTasks(state,['one','two'],'remove',before);expect(tasksForDay(state,'2026-10-09')).toHaveLength(0);expect(state.tasks).toHaveLength(2);
  state=updateDailyTasks(state,['two'],'restore',before);expect(tasksForDay(state,'2026-10-09')[0]).toMatchObject({id:'two',done:true});
  expect(editDailyTask(state,'two','不要改昨日','work',after).tasks).toEqual(state.tasks);
  expect(updateDailyTasks(state,['two'],'reopen',after).tasks).toEqual(state.tasks);
 });
 it('copies unfinished history into today once and never rewrites yesterday',()=>{
  const original=start(),next=carryDailyTask(original,'one','carried',after);
  expect(next.tasks[0]).toEqual(original.tasks[0]);expect(next.tasks[1]).toMatchObject({id:'carried',day:'2026-10-10',done:false,carriedFrom:'one'});
  expect(carryDailyTask(next,'one','duplicate',after)).toEqual(next);
  const removed=updateDailyTasks(next,['carried'],'remove',after);expect(carryDailyTask(removed,'one','duplicate',after).tasks).toHaveLength(2);
  expect(carryDailyTask(updateDailyTasks(original,['one'],'complete',before),'one','no',after).tasks).toHaveLength(1);
 });
 it('keeps daily archives through history retention and uses original calendar dates for journal folding',()=>{
  const old=start();const later=Date.parse('2026-12-01T00:00:00+08:00');old.settings.retentionDays=7;
  expect(pruneHistory(old,later).tasks).toEqual(old.tasks);
  const tree=buildJournalCalendar(old.tasks,t=>t.createdAt!,later,'UTC',t=>t.day!);expect(tree[0]).toMatchObject({kind:'month',closed:true,title:'2026年10月'});expect(tree[0].children[0].children[0].start).toBe('2026-10-09');
 });
 it('persists edits, deletion markers and archived dates in the native engine',()=>{
  const engine=new NativeEngine();engine.updatePolicy(JSON.stringify(start()),before);
  const next=updateDailyTasks(editDailyTask(engine.policy(),'one','本机保存','study',before),['one'],'remove',before);
  engine.updatePolicy(JSON.stringify(next),before);const restored=new NativeEngine(engine.serialize());expect(restored.policy().tasks).toEqual(next.tasks);expect(tasksForDay(restored.policy(),'2026-10-10')).toHaveLength(0);
 });
 it('rejects invalid titles and malformed calendar dates before saving',()=>{
  expect(()=>addDailyTask(initialState(),'x',' ','personal',before)).toThrow();expect(()=>addDailyTask(initialState(),'x','字'.repeat(101),'personal',before)).toThrow();
  const state=start();state.tasks[0].day='2026-02-30';expect(()=>parseState(state)).toThrow();
 });
});
