import { describe, expect, it } from 'vitest';
import { beginQuit, advanceQuit, mayForceQuit } from '../src/enforcement';
import { settleFocus, startFocus, cancelFocus } from '../src/focus';
import { initialState } from '../src/seed';
import { parseState } from '../src/state';
import type { FocusSession } from '../src/model';
const start=Date.parse('2026-10-05T10:00:00Z');
const session = (id='s',minutes=60): FocusSession => ({ id,startedAt:start,endsAt:start+minutes*60000,durationMinutes:minutes,listIds:['entertainment'],projectId:'work',mode:'friction',status:'active' });
describe('专注与奖励', () => {
  it('完成 60 分钟发放 15 分钟，重复结算不重复奖励', () => { const state=startFocus(initialState(),session()); const done=settleFocus(state,start+3600000); expect(done.rewards[0].minutes).toBe(15); expect(settleFocus(done,start+4000000).rewards).toHaveLength(1); });
  it('未到结束时刻不提前发放奖励', () => { expect(settleFocus(startFocus(initialState(),session()),start+3599999).rewards).toHaveLength(0); });
  it('取消的会话不发放奖励', () => { const cancelled=cancelFocus(startFocus(initialState(),session()),'s',start+1000,true); expect(settleFocus(cancelled,start+4000000).rewards).toHaveLength(0); });
  it('严格会话不能提前结束', () => { const state=startFocus(initialState(),{ ...session(),mode:'strict' }); expect(() => cancelFocus(state,'s',start+1000,true)).toThrow(); });
  it('拒绝并行专注与非法时长', () => { expect(() => startFocus(startFocus(initialState(),session()),session('s2'))).toThrow(); expect(() => startFocus(initialState(),{ ...session(),endsAt:start+1 })).toThrow(); });
  it('多次短专注累计奖励', () => { let state=initialState(); for (let i=0;i<2;i++) { const s=session(`s${i}`,30); s.startedAt+=i*1800000; s.endsAt+=i*1800000; state=settleFocus(startFocus(state,s),s.endsAt); } expect(state.rewards[0].minutes).toBe(15); });
  it('损坏的备份在写入之前拒绝', () => { expect(() => parseState({ ...initialState(),settings:{ ...initialState().settings,timezone:'invalid-zone' } })).toThrow(); expect(parseState(initialState()).version).toBe(1); });
});
describe('保护未保存工作', () => {
  const process={ pid:123,startedAt:100,executable:'/Apps/WeChat',protected:false };
  it('先宽限，再正常退出，再等待当次确认', () => { const plan=beginQuit(process,0,60,true); expect(advanceQuit(plan,59999,true).stage).toBe('grace'); const quit=advanceQuit(plan,60000,true); expect(quit.stage).toBe('request-quit'); const pending=advanceQuit(quit,90000,true); expect(pending.stage).toBe('needs-confirmation'); expect(mayForceQuit(pending,process,false)).toBe(false); expect(mayForceQuit(pending,process,true)).toBe(true); });
  it('默认不允许强制结束', () => { const pending={ ...beginQuit(process,0,60,false),stage:'needs-confirmation' as const }; expect(mayForceQuit(pending,process,true)).toBe(false); });
  it('相同 PID 已被新进程使用时不能结束它', () => { const pending={ ...beginQuit(process,0,60,true),stage:'needs-confirmation' as const }; expect(mayForceQuit(pending,{ ...process,startedAt:101 },true)).toBe(false); });
  it('保护系统进程，进程自行退出即结束流程', () => { expect(() => beginQuit({ ...process,protected:true },0,60,true)).toThrow(); expect(advanceQuit(beginQuit(process,0,60,false),1000,false).stage).toBe('done'); });
});
