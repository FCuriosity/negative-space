import {describe,it,expect,vi} from 'vitest';
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
 it('pauses safely on native failure and preserves records',async()=>{
  const {c,disk}=fixture();await c.call('set_management',{enabled:true});await c.tick(observation(0,null));await c.tick(observation(1));c.fail('helper exited');
  expect(c.status()).toMatchObject({enabled:false,lastError:'helper exited'});expect(disk()).toContain('wechat');
 });
});
