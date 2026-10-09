import {describe,it,expect} from 'vitest';
import {initialState} from '../src/seed';
import {parseState} from '../src/state';
import {advanceFocusSchedule,dropMinute,focusPlacement,putFocusPlacement,startFocusSpace,placementConflict} from '../src/focus-spaces';
import {mirrorLake} from '../src/mirror-lake';
import {NativeEngine} from '../src/native-engine';
import {evaluateTarget} from '../src/rules';
import type {FocusSpace} from '../src/model';
const space:FocusSpace={id:'reading',name:'深度阅读',durationMinutes:50,projectId:'study',listIds:['entertainment'],mode:'friction',tone:'blue'};
const monday=Date.parse('2026-10-12T09:00:00+08:00');
function planned(){const s=initialState();s.focusSpaces=[space];return putFocusPlacement(s,focusPlacement(space,1,540,'plan'));}
describe('saved focus spaces and weekly placement',()=>{
 it('migrates old states and persists spaces, snapshots and session labels',()=>{
  const raw:any=initialState();delete raw.focusSpaces;delete raw.scheduleRuns;expect(parseState(raw).focusSpaces).toEqual([]);
  const s=startFocusSpace(planned(),space,monday,'manual');const roundtrip=parseState(JSON.parse(JSON.stringify(s)));
  expect(roundtrip.focusSpaces[0]).toEqual(space);expect(roundtrip.schedules[0].focusSpace).toEqual(space);expect(roundtrip.sessions[0].spaceName).toBe('深度阅读');
 });
 it('uses dropped top edge and exact module duration, including uneven durations and midnight',()=>{
  expect(dropMinute(9*60*.8,1440*.8)).toBe(540);expect(dropMinute(-20,1152)).toBe(0);expect(dropMinute(2000,1152)).toBe(1435);
  const s=focusPlacement({...space,durationMinutes:37},6,1425,'late');expect(s.windows[0]).toEqual({days:[6],start:1425,end:22});expect(s.focusSpace?.durationMinutes).toBe(37);
  expect(()=>focusPlacement({...space,durationMinutes:0},1,540,'bad')).toThrow();expect(()=>focusPlacement(space,8,1440,'bad')).toThrow();
 });
 it('detects overlaps across days and week boundaries, allows touching edges, and moves without self-conflict',()=>{
  const s=planned();expect(()=>putFocusPlacement(s,focusPlacement(space,1,589,'overlap'))).toThrow('重叠');
  expect(()=>putFocusPlacement(s,focusPlacement(space,1,590,'adjacent'))).not.toThrow();expect(putFocusPlacement(s,focusPlacement(space,1,600,'plan')).schedules).toHaveLength(1);
  const late=focusPlacement({...space,durationMinutes:60},6,1425,'late');expect(placementConflict([late],focusPlacement(space,0,20,'next'))?.id).toBe('late');
  expect(placementConflict([{...late,enabled:false}],focusPlacement(space,0,20,'next'))).toBeUndefined();
 });
 it('template edits or deletion do not alter an already placed snapshot',()=>{
  const s=planned();s.focusSpaces[0]={...space,durationMinutes:15,name:'改名'};expect(s.schedules[0].focusSpace?.durationMinutes).toBe(50);s.focusSpaces=[];expect(advanceFocusSchedule(s,monday).sessions[0].durationMinutes).toBe(50);
 });
 it('starts once at the planned minute and settles into one star with focus rewards',()=>{
  const s=putFocusPlacement(initialState(),focusPlacement({...space,durationMinutes:60},1,540,'plan'));
  const started=advanceFocusSchedule(s,monday+15000);expect(started.sessions[0].startedAt).toBe(monday);expect(started.sessions[0].endsAt).toBe(monday+3600000);
  const again=advanceFocusSchedule(parseState(JSON.parse(JSON.stringify(started))),monday+30000);expect(again.sessions).toHaveLength(1);expect(again.scheduleRuns).toHaveLength(1);
  const done=advanceFocusSchedule(again,monday+3600000);expect(mirrorLake(done,monday+3600000).stars).toHaveLength(1);expect(done.rewards[0].minutes).toBe(15);
 });
 it('does not invent sessions after missed starts or while disabled; skips locked and busy slots without retrying',()=>{
  expect(advanceFocusSchedule(planned(),monday+60000).sessions).toHaveLength(0);expect(advanceFocusSchedule(planned(),monday,false).sessions).toHaveLength(0);
  const locked=advanceFocusSchedule(planned(),monday,true,true);expect(locked.scheduleRuns[0].outcome).toBe('locked');expect(advanceFocusSchedule(locked,monday+20000,true,false).sessions).toHaveLength(0);
  const busy=advanceFocusSchedule(startFocusSpace(planned(),space,monday-1000,'existing'),monday);expect(busy.sessions).toHaveLength(1);expect(busy.scheduleRuns[0].outcome).toBe('busy');
 });
 it('runs in the configured timezone and repeats next week rather than every tick',()=>{
  let s=planned();s.settings.timezone='UTC';expect(advanceFocusSchedule(s,monday).sessions).toHaveLength(0);
  s=advanceFocusSchedule(planned(),monday);s=advanceFocusSchedule(s,monday+7*86400000);expect(s.sessions).toHaveLength(2);expect(s.scheduleRuns).toHaveLength(2);
 });
 it('does not apply a missed focus-space restriction or fabricate missing project/list settings',()=>{
  const s=planned();s.rules=[];expect(evaluateTarget(s,'bilibili',{now:monday+60000,timezone:s.settings.timezone,usedSeconds:0,opens:0,continuousSeconds:0,intent:'open',bonusMinutes:0}).action).toBe('allow');
  s.projects=[];expect(advanceFocusSchedule(s,monday).scheduleRuns[0].outcome).toBe('invalid');expect(()=>startFocusSpace(s,space,monday,'bad')).toThrow('项目');
 });
 it('rejects inconsistent duration or rule snapshots in imported plans',()=>{
  const s=planned();s.schedules[0].windows[0].end=800;expect(()=>parseState(s)).toThrow();
 });
 it('preserves native scheduled sessions and occurrence IDs through stale UI saves and restart',()=>{
  const e=new NativeEngine();const s=e.policy();s.focusSpaces=[space];s.schedules=[focusPlacement(space,1,540,'native-plan')];const stale=JSON.stringify(s);e.setEnabled(true);
  const observation={at:monday,monotonicMs:1000,idleSeconds:0,locked:false,frontBundleId:null,processes:[]};e.tick(observation);expect(e.policy().sessions).toHaveLength(1);
  e.updatePolicy(stale,monday+1000);expect(e.policy().sessions).toHaveLength(1);expect(e.policy().scheduleRuns).toHaveLength(1);
  const restored=new NativeEngine(e.serialize());restored.tick({...observation,at:monday+2000});expect(restored.policy().sessions).toHaveLength(1);
 });
});
