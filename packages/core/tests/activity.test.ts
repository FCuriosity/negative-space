import { describe, expect, it } from 'vitest';
import { account, advanceBreak, dailyUsage, type Sample } from '../src/activity';
import { daySlices } from '../src/time';
const sample: Sample = { at:Date.parse('2026-10-05T12:00:00Z'),monotonicMs:10000,targetId:'bilibili',projectId:'work',idleSeconds:0,locked:false };
describe('前台与空闲统计', () => {
  it('切换窗口时把过去的间隔计入之前的应用', () => { const interval = account(sample,{ ...sample,targetId:'wechat',at:sample.at+5000,monotonicMs:15000 }); expect(interval?.targetId).toBe('bilibili'); expect(interval!.end-interval!.start).toBe(5000); });
  it('休眠断层、锁屏和倒退时钟不计时', () => { expect(account(sample,{ ...sample,at:sample.at+60000,monotonicMs:70000 })).toBeNull(); expect(account(sample,{ ...sample,at:sample.at+5000,monotonicMs:15000,locked:true })).toBeNull(); expect(account(sample,{ ...sample,at:sample.at-1,monotonicMs:15000 })).toBeNull(); });
  it('跨越空闲阈值时只计阈值之前的秒数', () => { const interval=account({ ...sample,idleSeconds:55 },{ ...sample,at:sample.at+10000,monotonicMs:20000,idleSeconds:65 },60); expect(interval!.end-interval!.start).toBe(5000); });
  it('午夜把时间拆到两天', () => { expect(daySlices(Date.parse('2026-10-05T15:59:58Z'),Date.parse('2026-10-05T16:00:03Z'),'Asia/Shanghai')).toEqual([{ day:'2026-10-05',seconds:2 },{ day:'2026-10-06',seconds:3 }]); });
  it('夏令时回拨的一天按 25 小时累计', () => { const slices=daySlices(Date.parse('2026-11-01T04:00:00Z'),Date.parse('2026-11-02T05:00:00Z'),'America/New_York'); expect(slices).toEqual([{ day:'2026-11-01',seconds:25*3600 }]); });
  it('统计可同时按日期、应用和项目筛选', () => { const interval=account(sample,{ ...sample,at:sample.at+5000,monotonicMs:15000 })!; expect(dailyUsage([interval],'UTC','2026-10-05','bilibili','work')).toBe(5); expect(dailyUsage([interval],'UTC','2026-10-05','bilibili','study')).toBe(0); });
  it('到达连续使用限额进入休息，完成休息后重置', () => { const due=advanceBreak({ continuousSeconds:1195 },10000,5,20,5); expect(due.until).toBe(310000); expect(advanceBreak(due,309999,5,20,5)).toEqual(due); expect(advanceBreak(due,310000,5,20,5)).toEqual({ continuousSeconds:0 }); });
  it('用户自然离开足够长时间也视为休息', () => { const away=advanceBreak({ continuousSeconds:600 },0,0,20,5); expect(advanceBreak(away,300000,0,20,5).continuousSeconds).toBe(0); });
});
