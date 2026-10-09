import {describe,it,expect,vi} from 'vitest';
import {RECOVERY_REASON_TAG} from '../../../packages/core/src/reason-tags';
import {WindowsController} from '../controller';
import type {NativeObservation,NativeProcess} from '../../../packages/core/src/native-engine';
const at=Date.now();
const process:NativeProcess={pid:123,startedAt:at-1000,executable:'C:\\WeChat.exe',protected:false,bundleId:'com.tencent.xinWeChat'};
const observation=(seconds:number,front:string|null=process.bundleId):NativeObservation=>({at:at+seconds*1000,monotonicMs:100000+seconds*1000,idleSeconds:0,locked:false,frontBundleId:front,processes:[process]});
function fixture(){let disk='';let mono=0;const perform=vi.fn(async(_kind:string,_process:NativeProcess)=>true),show=vi.fn();const c=new WindowsController(null,{perform,show},raw=>{disk=raw;},()=>mono);return {c,perform,show,disk:()=>disk,advance:(ms:number)=>{mono+=ms;}};}
describe('Windows native integration controller',()=>{
 it('persists each return from another foreground app exactly once',async()=>{
  const {c,disk}=fixture();await c.call('set_management',{enabled:true});
  await c.tick(observation(0,null));await c.tick(observation(1));await c.tick(observation(2));await c.tick(observation(3,null));await c.tick(observation(4));
  expect(c.engine.policy().opens).toHaveLength(2);
  const restored=new WindowsController(disk(),{perform:async()=>true,show(){}},()=>{});
  expect(restored.engine.policy().opens).toHaveLength(2);
 });
 it('requests normal close after the grace period, never automatically kills',async()=>{
  const {c,perform,show}=fixture();c.engine.policy().rules.find(r=>r.targetId==='wechat')!.dailyMinutes=0;
  await c.call('set_management',{enabled:true});await c.tick(observation(0));expect(show).toHaveBeenCalled();expect(perform).not.toHaveBeenCalled();
  await c.tick(observation(60));await c.tick(observation(91));expect(perform.mock.calls.map(x=>x[0])).toEqual(['quit']);
  const noticeId=c.engine.data.notices[0].id;
  await expect(c.call('force_quit',{noticeId,confirmed:true})).rejects.toThrow('未获准');
  c.observation.processes=[{...process,startedAt:at}];
  await expect(c.call('quit_now',{noticeId})).rejects.toThrow('进程已变化');
 });
 it('uses independent heartbeat leases without recording website visits or time',()=>{
  const {c,advance}=fixture();const before=c.engine.serialize();
  c.browser({browser:'edge',host:'',visit:'heartbeat',operation:'heartbeat'});
  expect(c.status().connectedBrowsers).toEqual(['edge']);expect(c.engine.serialize()).toBe(before);
  advance(90000);expect(c.status().browserConnected).toBe(false);
 });
 it('rejects background or stale browser observations',async()=>{
  const {c}=fixture();await c.call('set_management',{enabled:true});await c.tick(observation(0));
  const request={browser:'edge',host:'zhihu.com',visit:'a',operation:'observe',active:true};
  expect(c.browser(request)).toMatchObject({inactive:true});
  c.observation={...observation(0,'com.microsoft.edgemac'),at:Date.now()-6000};
  expect(c.browser(request)).toMatchObject({inactive:true});expect(c.engine.policy().opens).toHaveLength(0);
 });
 it('recognizes a running Chinese Bilibili process without waiting for registry refresh',async()=>{
  const {c}=fixture();const bili={...process,bundleId:'com.bilibili.bilibiliPC',executable:'D:\\应用\\哔哩哔哩.exe'};
  await c.call('set_management',{enabled:true});
  await c.tick({...observation(0,null),processes:[bili]});
  await c.tick({...observation(1,bili.bundleId),processes:[bili]});
  await c.tick({...observation(2,bili.bundleId),processes:[bili]});
  expect(c.status().installedApps.find(a=>a.bundleId===bili.bundleId)).toMatchObject({installed:true,running:true,processName:'哔哩哔哩.exe'});
  expect(c.engine.policy().opens.filter(o=>o.targetId==='bilibili-app')).toHaveLength(1);
  expect(c.engine.policy().usage.reduce((n,u)=>n+u.end-u.start,0)).toBe(1000);
  c.installed=[{name:'哔哩哔哩 App',bundleId:bili.bundleId,installed:true}];
  await c.tick({...observation(3,null),processes:[]});
  expect(c.status().installedApps.find(a=>a.bundleId===bili.bundleId)).toMatchObject({installed:true,running:false});
 });
 it('reports a rejected close instead of showing success or disabling management',async()=>{
  const {c,perform}=fixture();c.engine.policy().rules.find(r=>r.targetId==='wechat')!.dailyMinutes=0;
  await c.call('set_management',{enabled:true});await c.tick(observation(0));perform.mockResolvedValue(false);
  await expect(c.call('quit_now',{noticeId:c.engine.data.notices[0].id})).rejects.toThrow('操作未完成');
  expect(c.status().enabled).toBe(true);
  await c.tick(observation(60));expect(c.status().lastError).toContain('未能请求应用正常关闭');
 });
 it('records the recovery reason and normally closes only that opening, without activation or a grant',async()=>{
  const {c,perform}=fixture();await c.call('set_management',{enabled:true});
  await c.tick(observation(0,null));await c.tick(observation(1));
  const id=c.engine.policy().opens[0].id;
  await c.call('close_opening',{id,text:RECOVERY_REASON_TAG});
  expect(perform.mock.calls.map(x=>x[0])).toEqual(['quit']);
  expect(c.engine.policy().openReasons[0].text).toBe(RECOVERY_REASON_TAG);
  expect(c.engine.policy().opens).toHaveLength(1);
  expect(c.engine.policy().opens[0].reasonStatus).toBe('recorded');expect(c.engine.data.grants).toEqual({});
 });
 it('allows choosing to close outside an allowed window even in strict mode',async()=>{
  const {c,perform}=fixture();await c.call('set_management',{enabled:true});await c.tick(observation(0,null));await c.tick(observation(1));
  const event=c.engine.policy().opens[0];event.outsideAllowedWindow=true;event.intention='pending';
  c.engine.policy().rules.find(r=>r.targetId==='wechat')!.mode='strict';
  await c.call('close_opening',{id:event.id,text:RECOVERY_REASON_TAG});
  expect(c.engine.policy().opens[0].intention).toBe('accidental');expect(perform.mock.calls[0][0]).toBe('quit');expect(c.engine.data.grants).toEqual({});
 });
 it('keeps a reason pending when normal close is rejected',async()=>{
  const {c,perform}=fixture();await c.call('set_management',{enabled:true});await c.tick(observation(0,null));await c.tick(observation(1));
  perform.mockResolvedValue(false);
  await expect(c.call('close_opening',{id:c.engine.policy().opens[0].id,text:RECOVERY_REASON_TAG})).rejects.toThrow('未能请求正常关闭');
  expect(c.engine.policy().opens[0].reasonStatus).toBe('pending');expect(c.engine.policy().openReasons).toHaveLength(0);
 });
 it('does not close a restarted process or an application from an older opening record',async()=>{
  const {c,perform}=fixture();await c.call('set_management',{enabled:true});await c.tick(observation(0,null));await c.tick(observation(1));
  const id=c.engine.policy().opens[0].id;
  c.observation.processes=[{...process,startedAt:at}];
  await expect(c.call('close_opening',{id,text:RECOVERY_REASON_TAG})).rejects.toThrow('进程已退出或变化');
  await c.tick(observation(2,null));await c.tick(observation(3));
  await expect(c.call('close_opening',{id,text:RECOVERY_REASON_TAG})).rejects.toThrow('这次打开已结束');expect(perform).not.toHaveBeenCalled();
 });
 it('pauses safely on native failure and preserves records',async()=>{
  const {c,disk}=fixture();await c.call('set_management',{enabled:true});await c.tick(observation(0,null));await c.tick(observation(1));c.fail('helper exited');
  expect(c.status()).toMatchObject({enabled:false,lastError:'helper exited'});expect(disk()).toContain('wechat');
 });
});
