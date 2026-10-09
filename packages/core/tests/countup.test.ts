import {describe,it,expect} from 'vitest';
import {initialState} from '../src/seed';
import {parseState} from '../src/state';
import {startFocusSpace,advanceFocusSchedule,focusPlacement,putFocusPlacement} from '../src/focus-spaces';
import {finishCountUp,settleFocus,startFocus} from '../src/focus';
import {evaluateTarget} from '../src/rules';
import {NativeEngine} from '../src/native-engine';
import {mirrorLake} from '../src/mirror-lake';
import type {FocusSpace} from '../src/model';
const at=Date.parse('2026-10-12T09:00:00+08:00');
const space:FocusSpace={id:'open',name:'自由阅读',durationMinutes:25,projectId:'study',listIds:['entertainment'],tone:'blue',mode:'friction',timerMode:'countup',backgroundId:'photo'};
const started=()=>startFocusSpace(initialState(),space,at,'session');
describe('count-up focus',()=>{
 it('remains active across its reserved duration, midnight, persistence and rules evaluation',()=>{
  const state=settleFocus(parseState(JSON.parse(JSON.stringify(started()))),at+86400000);
  expect(state.sessions[0].status).toBe('active');expect(state.sessions[0].durationMinutes).toBe(0);
  state.rules=[];state.schedules=[];
  expect(evaluateTarget(state,'bilibili',{now:at+86400000,timezone:state.settings.timezone,usedSeconds:0,opens:0,continuousSeconds:0,intent:'open',bonusMinutes:0}).action).not.toBe('allow');
  expect(()=>startFocusSpace(state,space,at+1000,'other')).toThrow('已有');
 });
 it('finishes using actual seconds, earns a star and rewards exactly once',()=>{
  const done=finishCountUp(started(),'session',at+3601500);
  expect(done.sessions[0]).toMatchObject({status:'completed',durationMinutes:60.025,endsAt:at+3601500,endedAt:at+3601500,backgroundId:'photo'});
  expect(done.rewards[0].minutes).toBe(15);expect(mirrorLake(done,at+3601500).stars).toHaveLength(1);
  expect(finishCountUp(done,'session',at+4000000)).toEqual(done);expect(settleFocus(done,at+4000000)).toEqual(done);
  expect(parseState(JSON.parse(JSON.stringify(done))).sessions).toEqual(done.sessions);
 });
 it('records sub-minute attempts without stars or rewards and rejects backward completion time',()=>{
  expect(()=>finishCountUp(started(),'session',at-1)).toThrow();
  const done=finishCountUp(started(),'session',at+30000);expect(done.sessions[0]).toMatchObject({status:'cancelled',durationMinutes:.5,endedAt:at+30000});expect(done.rewards).toHaveLength(0);expect(mirrorLake(done,at+30000).stars).toHaveLength(0);
 });
 it('rejects strict open-ended timers and finishing bounded timers through the manual API',()=>{
  expect(()=>startFocusSpace(initialState(),{...space,mode:'strict'},at,'bad')).toThrow();
  const regular=startFocusSpace(initialState(),{...space,timerMode:'countdown'},at,'session');expect(()=>finishCountUp(regular,'session',at+60000)).toThrow();
  expect(()=>startFocus(initialState(),{...started().sessions[0],mode:'strict'})).toThrow();
 });
 it('uses a reserved end when scheduled, while the visible timer counts up',()=>{
  const plan=putFocusPlacement(initialState(),focusPlacement(space,1,540,'plan'));
  const active=advanceFocusSchedule(plan,at);expect(active.sessions[0]).toMatchObject({timerMode:'countup',durationMinutes:25,endsAt:at+1500000,scheduleId:'plan',backgroundId:'photo'});
  expect(()=>finishCountUp(active,active.sessions[0].id,at+60000)).toThrow();
  const done=advanceFocusSchedule(active,at+1500000);expect(done.sessions[0].status).toBe('completed');expect(mirrorLake(done,at+1500000).stars).toHaveLength(1);
 });
 it('native completion persists and cannot be undone by a stale UI save',()=>{
  const engine=new NativeEngine();engine.updatePolicy(JSON.stringify(started()),at);const stale=JSON.stringify(engine.policy());
  const restored=new NativeEngine(engine.serialize());restored.finishCountUp('session',at+3600000);restored.updatePolicy(stale,at+3600001);
  expect(restored.policy().sessions[0].status).toBe('completed');expect(restored.policy().rewards[0].minutes).toBe(15);
  expect(new NativeEngine(restored.serialize()).policy().sessions[0].durationMinutes).toBe(60);
 });
});
describe('local backgrounds',()=>{
 it('defaults old states and round trips local assets plus settings',()=>{
  const old:any=initialState();delete old.focusBackgrounds;expect(parseState(old).focusBackgrounds).toEqual([]);
  const state=initialState();state.focusBackgrounds=[{id:'photo',name:'湖边.jpg',dataUrl:'data:image/jpeg;base64,AA=='}];state.settings.focusBackgroundId='photo';state.settings.focusTimerMode='countup';expect(parseState(state)).toEqual(state);
 });
 it('rejects external URLs, active markup and oversized assets',()=>{
  const s=initialState();for(const dataUrl of ['https://example.com/a.jpg','data:image/svg+xml;base64,AA==','data:image/jpeg;base64,'+'A'.repeat(600000)]){s.focusBackgrounds=[{id:'x',name:'photo',dataUrl}];expect(()=>parseState(s)).toThrow();}
 });
});
