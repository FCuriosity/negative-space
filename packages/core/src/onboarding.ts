import type {AppState} from './model';
import {newRule} from './seed';

/** Only called for an empty desktop/browser store, never as a legacy migration. */
export function firstRunState(state:AppState):AppState {
 return {...state,rules:[],schedules:[],settings:{...state.settings,onboarding:{stage:'pending'}}};
}
export function prepareFirstRule(state:AppState,targetId:string,minutes:number):AppState {
 if(!state.settings.onboarding||state.settings.onboarding.stage==='complete')throw Error('首次引导已经结束');
 if(state.rules.some(r=>r.id!=='first-gentle-rule')||state.schedules.length||state.sessions.length)throw Error('你已经开始自行配置，请在自律规则中检查现有规则，再从连接管理开启');
 const target=state.targets.find(t=>t.id===targetId&&t.kind==='app'&&!t.protected);
 if(!target)throw Error('请选择一个可管理的电脑应用');
 if(!Number.isInteger(minutes)||minutes<1||minutes>180)throw Error('每日时长请设置为 1–180 分钟的整数');
 const rule={...newRule('first-gentle-rule',`${target.name} · 我的第一条规则`,targetId),mode:'gentle' as const,dailyMinutes:minutes,graceSeconds:60,forceQuitOptIn:false};
 return {...state,rules:[rule],settings:{...state.settings,onboarding:{stage:'ready',ruleId:rule.id}}};
}
