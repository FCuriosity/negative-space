import type { AppState, Rule } from './model';
import { dailyUsage } from './activity';
import { dailyLimits } from './rules';
import { dayKey } from './time';
/** One daily view for both limits; the meter must use remaining, not elapsed quota. */
export function dailyQuota(state:AppState,rule:Rule,now:number) {
  const day=dayKey(now,state.settings.timezone);
  const limits=dailyLimits(rule,now,state.settings.timezone);
  const usedSeconds=dailyUsage(state.usage,state.settings.timezone,day,rule.targetId);
  const opens=state.opens.filter(o=>o.targetId===rule.targetId && dayKey(o.at,state.settings.timezone)===day).length;
  const bonusMinutes=state.rewards.filter(r=>r.targetId===rule.targetId && r.day===day).reduce((sum,r)=>sum+r.minutes,0);
  const totalSeconds=limits.dailyMinutes===null?null:(limits.dailyMinutes+bonusMinutes)*60;
  const remainingSeconds=totalSeconds===null?null:Math.max(0,totalSeconds-usedSeconds);
  const remainingOpens=limits.dailyOpens===null?null:Math.max(0,limits.dailyOpens-opens);
  const basis=totalSeconds!==null?'time':remainingOpens!==null?'opens':'unlimited';
  const total=basis==='time'?totalSeconds:basis==='opens'?limits.dailyOpens:null;
  const remaining=basis==='time'?remainingSeconds:basis==='opens'?remainingOpens:null;
  const ratio=total===null?null:total===0?0:Math.max(0,Math.min(1,remaining!/total));
  return {limits,usedSeconds,opens,bonusMinutes,totalSeconds,remainingSeconds,remainingOpens,basis,ratio};
}
