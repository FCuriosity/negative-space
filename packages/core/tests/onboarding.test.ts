import {describe,it,expect,vi} from 'vitest';
import {NativeEngine,firstRunSnapshot} from '../src/native-engine';
import {firstRunState,prepareFirstRule} from '../src/onboarding';
import {initialState,newRule} from '../src/seed';
import {parseState} from '../src/state';
import {WindowsController} from '../../../apps/windows/controller';
import * as mac from '../../../apps/macos/runtime';
const at=Date.parse('2026-10-09T10:00:00+08:00');
const process={pid:55,startedAt:at-1000,executable:'/test/wechat',protected:false,bundleId:'com.tencent.xinWeChat'};
const obs=(seconds:number)=>({at:at+seconds*1000,monotonicMs:seconds*1000,idleSeconds:0,locked:false,frontBundleId:process.bundleId,processes:[process]});
describe('first-run onboarding safety',()=>{
 it('starts empty and paused, persists unfinished setup, and rejects early activation',()=>{
  const engine=new NativeEngine(firstRunSnapshot());
  expect(engine.policy().rules).toEqual([]);expect(engine.data.enabled).toBe(false);
  expect(()=>engine.setEnabled(true)).toThrow('安全演示');
  expect(engine.tick(obs(300))).toEqual([]);expect(engine.policy().opens).toEqual([]);
  const restarted=new NativeEngine(engine.serialize());expect(restarted.policy().settings.onboarding?.stage).toBe('pending');expect(restarted.policy().rules).toEqual([]);
 });
 it('prepares exactly one gentle rule without usage, reasons, focus or management side effects',()=>{
  const engine=new NativeEngine(firstRunSnapshot());const before=engine.serialize();
  const next=prepareFirstRule(engine.policy(),'wechat',1);
  expect(engine.serialize()).toBe(before);expect(next.rules).toHaveLength(1);
  expect(next.rules[0]).toMatchObject({targetId:'wechat',dailyMinutes:1,dailyOpens:null,mode:'gentle',allowedWindows:[],breakEveryMinutes:null,graceSeconds:60,forceQuitOptIn:false});
  engine.updatePolicy(JSON.stringify(next),at);expect(engine.data.enabled).toBe(false);
  expect(engine.tick(obs(500))).toEqual([]);expect(engine.policy().opens).toEqual([]);expect(engine.policy().openReasons).toEqual([]);expect(engine.policy().sessions).toEqual([]);
  expect(new NativeEngine(engine.serialize()).policy().settings.onboarding?.stage).toBe('ready');
 });
 it('only activates on an explicit switch and waits for the configured quota and save grace',()=>{
  const engine=new NativeEngine(firstRunSnapshot());engine.updatePolicy(JSON.stringify(prepareFirstRule(engine.policy(),'wechat',1)),at);
  engine.setEnabled(true);
  for(let i=0;i<60;i++)expect(engine.tick(obs(i))).toEqual([]);
  expect(engine.tick(obs(60)).map(c=>c.kind)).toEqual(['show']);
  expect(engine.tick(obs(61))).toEqual([]);
  expect(engine.tick(obs(120)).map(c=>c.kind)).toEqual(['quit']);
  expect(engine.data.notices[0].quit.forceQuitOptIn).toBe(false);
 });
 it('validates selected apps and duration and preserves legacy installations',()=>{
  const fresh=firstRunState(initialState());
  for(const value of [0,-1,181,1.5,NaN])expect(()=>prepareFirstRule(fresh,'wechat',value)).toThrow();
  expect(()=>prepareFirstRule(fresh,'bilibili',30)).toThrow();
  const old=new NativeEngine();const restored=new NativeEngine(old.serialize());
  expect(restored.policy().settings.onboarding).toBeUndefined();expect(restored.policy().rules).toEqual(old.policy().rules);
  expect(()=>prepareFirstRule(parseState(initialState()),'wechat',30)).toThrow();
 });
 it('preserves manual setup after skipping and allows its explicit activation',()=>{
  const engine=new NativeEngine(firstRunSnapshot());const state=engine.policy();state.rules=[newRule('manual','自行设置','wechat')];
  expect(()=>prepareFirstRule(state,'wechat',30)).toThrow('自行配置');expect(state.rules[0].id).toBe('manual');
  engine.setEnabled(true);expect(engine.policy().settings.onboarding?.stage).toBe('complete');
 });
 it('uses the paused first-run state in the Windows entry point',async()=>{
  const perform=vi.fn(async()=>true);const controller=new WindowsController(null,{perform,show:vi.fn()},()=>{});
  await expect(controller.call('set_management',{enabled:true})).rejects.toThrow('安全演示');
  await controller.tick(obs(300));expect(perform).not.toHaveBeenCalled();expect(controller.engine.policy().rules).toEqual([]);
  await controller.call('save_state',{json:JSON.stringify(prepareFirstRule(controller.engine.policy(),'wechat',30))});
  expect(controller.status().enabled).toBe(false);
  await controller.call('set_management',{enabled:true});expect(controller.status().enabled).toBe(true);expect(new NativeEngine(controller.engine.serialize()).policy().settings.onboarding?.stage).toBe('complete');
 });
 it('uses the paused first-run state in the Mac entry point',()=>{
  const state=JSON.parse(mac.initialize(null));expect(state.rules).toEqual([]);
  expect(()=>mac.setEnabled(true)).toThrow('安全演示');
  mac.save(JSON.stringify(prepareFirstRule(state,'wechat',30)),at);
  expect(JSON.parse(mac.status()).enabled).toBe(false);
  mac.setEnabled(true);expect(JSON.parse(mac.status()).enabled).toBe(true);
 });
});
