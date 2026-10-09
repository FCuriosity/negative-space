import { describe, expect, it, vi } from 'vitest';
import { CONNECTION_ALARM, registerBrowserHeartbeat } from '../src/heartbeat';
const flush = async () => { for(let i=0;i<8;i++) await Promise.resolve(); };
function fixture(existing = false) {
  let alarm!: (event:{name:string})=>void, startup!:()=>void, installed!:()=>void;
  const api={alarms:{get:vi.fn().mockResolvedValue(existing?{periodInMinutes:0.5}:undefined),create:vi.fn().mockResolvedValue(undefined),onAlarm:{addListener:(fn:typeof alarm)=>{alarm=fn;}}},runtime:{onStartup:{addListener:(fn:()=>void)=>{startup=fn;}},onInstalled:{addListener:(fn:()=>void)=>{installed=fn;}}}};
  return {api, fire:(name=CONNECTION_ALARM)=>alarm({name}),startup:()=>startup(),installed:()=>installed()};
}
describe('扩展独立连接心跳',()=>{
  it('安装、重启及普通网页也会续约，不依赖内容脚本',async()=>{
    const f=fixture(),send=vi.fn().mockResolvedValue(undefined);
    registerBrowserHeartbeat(send,f.api as unknown as Pick<typeof chrome,'alarms'|'runtime'>);await flush();
    expect(f.api.alarms.create).toHaveBeenCalledWith(CONNECTION_ALARM,{periodInMinutes:0.5});
    expect(send).toHaveBeenCalledTimes(1);
    f.fire();await flush();f.startup();await flush();f.installed();await flush();
    expect(send).toHaveBeenCalledTimes(4);
    f.fire('unrelated');await flush();expect(send).toHaveBeenCalledTimes(4);
  });
  it('恢复 worker 不重置现有闹钟，失败后下一次心跳重试',async()=>{
    const f=fixture(true),send=vi.fn().mockRejectedValueOnce(new Error('host closed')).mockResolvedValue(undefined);
    registerBrowserHeartbeat(send,f.api as unknown as Pick<typeof chrome,'alarms'|'runtime'>);await flush();
    expect(f.api.alarms.create).not.toHaveBeenCalled();
    f.fire();await flush();expect(send).toHaveBeenCalledTimes(2);
  });
  it('慢连接不堆叠重复心跳',async()=>{
    const f=fixture();let finish!:()=>void;const send=vi.fn(()=>new Promise<void>(resolve=>{finish=resolve;}));
    registerBrowserHeartbeat(send,f.api as unknown as Pick<typeof chrome,'alarms'|'runtime'>);await flush();
    f.fire();f.fire();expect(send).toHaveBeenCalledTimes(1);
    finish();await flush();f.fire();expect(send).toHaveBeenCalledTimes(2);finish();await flush();
  });
});
