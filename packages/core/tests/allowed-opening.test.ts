import {describe,it,expect} from 'vitest';
import {NativeEngine,type NativeObservation,type NativeProcess} from '../src/native-engine';
import {outsideAllowedWindow,mirrorLake} from '../src/mirror-lake';
import {saveOpenReason} from '../src/journal';
import {CHALLENGE_TEXT} from '../src/rules';
const at=Date.parse('2026-10-07T10:00:00+08:00'); // Wednesday
const app:NativeProcess={pid:888,startedAt:at-1000,executable:'/test/bili',bundleId:'com.bilibili.bilibiliPC',protected:false};
const obs=(second:number,front=app.bundleId):NativeObservation=>({at:at+second*1000,monotonicMs:second*1000,frontBundleId:front,processes:[app],idleSeconds:0,locked:false});
function setup(mode:'gentle'|'friction'|'strict'='gentle'){
 const e=new NativeEngine();Object.assign(e.policy().rules.find(r=>r.targetId==='bilibili-app')!,{dailyMinutes:null,dailyOpens:null,breakEveryMinutes:null,mode,allowedWindows:[{days:[3],start:1200,end:1320}]});
 e.setEnabled(true);e.tick(obs(0,'com.apple.Safari'));e.tick(obs(1));return e;
}
describe('allowed-time opening review',()=>{
 it('requires reason and an explicit judgment before out-of-window grants, with no partial writes on failure',()=>{
  const e=setup(),event=e.policy().opens[0],notice=e.data.notices[0];
  expect(event.outsideAllowedWindow).toBe(true);expect(event.quotaExceeded).toEqual([]);expect(notice.openEventId).toBe(event.id);
  expect(()=>e.allow(notice.id,at+2000,2000,'','回复消息')).toThrow('确认');
  expect(()=>e.allow(notice.id,at+2000,2000,'','','accidental')).toThrow('理由');
  expect(()=>e.saveOpenReason(event.id,'',at+2000,true)).toThrow();
  expect(e.policy().openReasons).toHaveLength(0);expect(mirrorLake(e.policy(),at+2000).holes).toHaveLength(0);
  e.allow(notice.id,at+2000,2000,'','习惯性摸鱼','accidental');
  expect(mirrorLake(e.policy(),at+2000).holes).toHaveLength(1);expect(e.data.grants[event.targetId]).toBeDefined();
  expect(e.policy().openReasons.find(r=>r.eventId===event.id)?.text).toBe('习惯性摸鱼');
 });
 it('records intentional entries without a hole, preserves snapshots across edits and restart, and deduplicates classifications',()=>{
  const e=setup(),id=e.policy().opens[0].id;
  e.saveOpenReason(id,'回复必要消息',at+2000,false,'intentional');expect(mirrorLake(e.policy(),at+2000).holes).toHaveLength(0);
  e.saveOpenReason(id,'其实是随手点开',at+3000,false,'accidental');e.saveOpenReason(id,'其实是随手点开',at+3000,false,'accidental');
  const next=structuredClone(e.policy());next.rules.forEach(r=>r.allowedWindows=[]);e.updatePolicy(JSON.stringify(next),at+3000);
  const restored=new NativeEngine(e.serialize());expect(mirrorLake(restored.policy(),at+3000).holes).toHaveLength(1);expect(restored.policy().openReasons).toHaveLength(1);
  restored.classifyOpening(id,'intentional');expect(mirrorLake(restored.policy(),at+3000).holes).toHaveLength(0);
 });
 it('keeps strict restrictions and friction wait/challenge even after recording a judgment',()=>{
  const strict=setup('strict'),id=strict.policy().opens[0].id;strict.saveOpenReason(id,'无意识打开',at+2000,false,'accidental');
  expect(()=>strict.allow(strict.data.notices[0].id,at+40000,40000,CHALLENGE_TEXT,'无意识打开','accidental')).toThrow();expect(strict.data.grants).toEqual({});
  const friction=setup('friction'),notice=friction.data.notices[0];
  expect(()=>friction.allow(notice.id,at+30000,30000,CHALLENGE_TEXT,'回复必要的消息','intentional')).toThrow();
  friction.allow(notice.id,at+31000,31000,CHALLENGE_TEXT,'回复必要的消息','intentional');expect(friction.data.grants['bilibili-app']).toBeDefined();
 });
 it('reviews a fresh activation during a grant; prompt returns do not duplicate entries',()=>{
  const e=setup();e.allow(e.data.notices[0].id,at+2000,2000,'','回复消息','intentional');e.prepareReturn(app);e.tick(obs(3));expect(e.policy().opens).toHaveLength(1);
  e.tick(obs(4,'com.apple.Safari'));e.tick(obs(5));expect(e.data.notices).toHaveLength(0);expect(e.policy().opens).toHaveLength(2);
  const latest=e.policy().opens[1];expect(latest.outsideAllowedWindow).toBe(true);expect(()=>e.saveOpenReason(latest.id,'',at+6000,true)).toThrow();
  e.saveOpenReason(latest.id,'无意识切回',at+6000,false,'accidental');expect(mirrorLake(e.policy(),at+6000).holes).toHaveLength(1);
 });
 it('honors multiple windows, weekdays, exact boundaries, overnight ranges, timezone and disabled rules',()=>{
  const e=setup(),s=e.policy(),r=s.rules.find(r=>r.targetId==='bilibili-app')!;
  r.allowedWindows=[{days:[3],start:600,end:660},{days:[3],start:1200,end:60}];
  const outside=(date:string)=>outsideAllowedWindow(s,r.targetId,Date.parse(date));
  expect(outside('2026-10-07T10:00:00+08:00')).toBe(false);expect(outside('2026-10-07T11:00:00+08:00')).toBe(true);
  expect(outside('2026-10-07T20:00:00+08:00')).toBe(false);expect(outside('2026-10-08T00:59:00+08:00')).toBe(false);expect(outside('2026-10-08T01:00:00+08:00')).toBe(true);
  expect(outside('2026-10-08T10:00:00+08:00')).toBe(true);s.settings.timezone='UTC';expect(outside('2026-10-07T10:00:00+08:00')).toBe(true);
  r.enabled=false;expect(outside('2026-10-07T10:00:00+08:00')).toBe(false);
 });
 it('one activation exceeding both time window and quota creates at most one hole; old entries are not inferred',()=>{
  const e=setup(),s=e.policy(),r=s.rules.find(r=>r.targetId==='bilibili-app')!;r.dailyOpens=0;
  e.tick(obs(2,'com.apple.Safari'));e.tick(obs(3));const entry=e.policy().opens[1];expect(entry.outsideAllowedWindow).toBe(true);expect(entry.quotaExceeded).toEqual(['daily-opens']);
  e.saveOpenReason(entry.id,'无意识打开',at+4000,false,'accidental');expect(mirrorLake(e.policy(),at+4000).holes).toHaveLength(1);
  const old={id:'old',targetId:entry.targetId,at:at-1000,kind:'activation' as const};e.policy().opens.push(old);expect(mirrorLake(e.policy(),at+4000).entries).toHaveLength(2);
  expect(()=>saveOpenReason(e.policy(),entry.id,'test',at+4000,false,'invented')).toThrow();
 });
});
