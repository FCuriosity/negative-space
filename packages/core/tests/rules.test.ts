import { describe, expect, it } from 'vitest';
import { canOverride, CHALLENGE_TEXT, evaluateRule, evaluateTarget, inWindow } from '../src/rules';
import { RuleSchema } from '../src/model';
import type { EvaluationContext } from '../src/model';
import { initialState, newRule } from '../src/seed';
const monday = Date.parse('2026-10-05T12:00:00Z');
const context = (patch: Partial<EvaluationContext> = {}): EvaluationContext => ({ now: monday, timezone: 'UTC', usedSeconds: 0, opens: 0, continuousSeconds: 0, bonusMinutes: 0, intent: 'open', ...patch });
const rule = () => ({ ...newRule('test','测试','bilibili'), mode: 'strict' as const });

describe('配额与时段', () => {
  it('时间配额在精确边界生效', () => { expect(evaluateRule(rule(),context({ usedSeconds:1799 })).action).toBe('allow'); expect(evaluateRule(rule(),context({ usedSeconds:1800 })).reason).toBe('daily-time'); });
  it('零分钟是禁止，而不是无限制', () => { expect(evaluateRule({ ...rule(),dailyMinutes:0 },context()).action).toBe('block'); });
  it('奖励只增加时长额度', () => { expect(evaluateRule(rule(),context({ usedSeconds:1800,bonusMinutes:15 })).remainingSeconds).toBe(900); expect(evaluateRule({ ...rule(),dailyOpens:10 },context({ opens:10,bonusMinutes:15 })).reason).toBe('daily-opens'); });
  it('打开次数限制下次启动，不驱逐已在使用的第十次会话', () => { const r = { ...rule(),dailyOpens:10 }; expect(evaluateRule(r,context({ opens:9 })).action).toBe('allow'); expect(evaluateRule(r,context({ opens:10 })).action).toBe('block'); expect(evaluateRule(r,context({ opens:10,intent:'continue' })).action).toBe('allow'); });
  it('按星期覆盖规则，未覆盖的日期使用默认值', () => { const r = { ...rule(),weekdays:{ '1':{ dailyMinutes:60,dailyOpens:null } } }; expect(evaluateRule(r,context({ usedSeconds:1800 })).action).toBe('allow'); expect(evaluateRule(r,context({ now:monday+86400_000,usedSeconds:1800 })).action).toBe('block'); });
  it('跨午夜窗口归属开始的星期，结束边界不包含', () => { const w = { days:[1],start:1320,end:120 }; expect(inWindow(Date.parse('2026-10-06T01:59:00Z'),'UTC',w)).toBe(true); expect(inWindow(Date.parse('2026-10-06T02:00:00Z'),'UTC',w)).toBe(false); expect(inWindow(Date.parse('2026-10-05T01:00:00Z'),'UTC',w)).toBe(false); });
  it('使用指定时区而不是宿主系统时区', () => { expect(inWindow(Date.parse('2026-10-05T12:00:00Z'),'Asia/Shanghai',{ days:[1],start:1200,end:1260 })).toBe(true); });
  it('奖励不能绕开允许时段', () => { expect(evaluateRule({ ...rule(),allowedWindows:[{ days:[1],start:1200,end:1380 }] },context({ bonusMinutes:90 })).reason).toBe('outside-window'); });
  it('关闭单项规则不影响已启用的专注列表', () => { const state = initialState(); state.rules = [{ ...rule(),enabled:false }]; state.sessions = [{ id:'s',startedAt:monday-1000,endsAt:monday+10000,durationMinutes:1,mode:'strict',listIds:['entertainment'],projectId:'work',status:'active' }]; expect(evaluateTarget(state,'bilibili',context()).action).toBe('block'); });
  it('多个规则按更严格的结果合并', () => { const state = initialState(); state.rules = [{ ...rule(),dailyMinutes:0,mode:'gentle' },{ ...rule(),id:'second',dailyMinutes:0,mode:'strict' }]; expect(evaluateTarget(state,'bilibili',context()).action).toBe('block'); });
  it('循环时间表可独立限制没有单项规则的目标', () => { const state = initialState(); state.rules=[]; state.settings.timezone='UTC'; state.schedules=[{ id:'weekly',name:'周一',listIds:['entertainment'],windows:[{ days:[1],start:0,end:1439 }],mode:'strict',enabled:true }]; expect(evaluateTarget(state,'youtube',context()).reason).toBe('focus'); expect(evaluateTarget(state,'youtube',context({ now:monday+86400_000 })).action).toBe('allow'); });
  it('系统保护目标永远允许', () => { const state = initialState(); state.targets[0].protected=true; state.rules=[{ ...rule(),dailyMinutes:0 }]; expect(evaluateTarget(state,'bilibili',context()).action).toBe('allow'); });
  it('拒绝负额度和空日期窗口', () => { expect(RuleSchema.safeParse({ ...rule(),dailyMinutes:-1 }).success).toBe(false); expect(RuleSchema.safeParse({ ...rule(),allowedWindows:[{ days:[],start:60,end:120 }] }).success).toBe(false); });
});
describe('分级解除', () => {
  it('摩擦需要等待时间、完整挑战与理由同时满足', () => { expect(canOverride('friction',1000,30999,CHALLENGE_TEXT,'需要回复重要消息')).toBe(false); expect(canOverride('friction',1000,31000,'错误输入','需要回复重要消息')).toBe(false); expect(canOverride('friction',1000,31000,CHALLENGE_TEXT,'看看')).toBe(false); expect(canOverride('friction',1000,31000,CHALLENGE_TEXT,'需要回复重要消息')).toBe(true); });
  it('本地输入不能解除严格或托管模式', () => { for (const mode of ['strict','managed'] as const) expect(canOverride(mode,0,999999,CHALLENGE_TEXT,'我想打开应用')).toBe(false); });
});
