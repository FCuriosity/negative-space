import {describe,it,expect} from 'vitest';
import {AndroidRuntime,androidApps} from '../runtime';
const start=Date.UTC(2026,9,12,1);
function runtime(){const r=new AndroidRuntime(null);r.call('first_rule',{targetId:'wechat',minutes:1},start,0);r.call('management',{enabled:true},start,0);r.tick('cn.liubai.app.preview',start,0,false);return r;}
describe('Android native rules adapter',()=>{
 it('starts with no rules and never starts managing on install or restart',()=>{const r=new AndroidRuntime(null);expect(r.state().rules).toEqual([]);expect(r.engine.data.enabled).toBe(false);const configured=runtime();const reopened=new AndroidRuntime(configured.snapshot());expect(reopened.engine.data.enabled).toBe(false);expect(reopened.state().rules).toHaveLength(1);});
 it('counts each foreground return, including sub-second events, but not same-app activity transitions',()=>{const r=runtime();r.tick('com.tencent.mm',start+100,100,false);r.tick('com.tencent.mm',start+200,200,false);r.tick('com.android.launcher',start+300,300,false);r.tick('com.tencent.mm',start+400,400,false);expect(r.state().opens).toHaveLength(2);r.tick('cn.liubai.app.preview',start+500,500,false);r.tick('com.tencent.mm',start+600,600,false);expect(r.state().opens).toHaveLength(3);});
 it('only tracks selected apps and excludes screen-off periods',()=>{const r=runtime();r.tick('tv.danmaku.bili',start+1000,1000,false);expect(r.state().opens).toHaveLength(0);r.tick('com.tencent.mm',start+2000,2000,false);r.tick('com.tencent.mm',start+3000,3000,false);r.tick(null,start+4000,4000,true);r.tick(null,start+60000,60000,true);expect(r.state().usage.reduce((s,x)=>s+(x.end-x.start),0)).toBeLessThanOrEqual(2000);});
 it('keeps the reminder available when entering Liubai, records accidental opening and grants five minutes',()=>{const r=runtime();const s=r.state();r.call('save',{state:{...s,rules:s.rules.map(x=>({...x,dailyOpens:0}))}},start,0);const result=r.tick('com.tencent.mm',start+1000,1000,false);expect(result.overlayNotice).not.toBeNull();const notice=result.notice!;expect(r.tick('cn.liubai.app.preview',start+2000,2000,false).overlayNotice).toBeNull();expect(r.engine.data.notices).toHaveLength(1);r.call('allow',{id:notice.id,reason:'无意识打开',intention:'accidental'},start+3000,3000);expect(r.state().opens[0].intention).toBe('accidental');r.tick('com.tencent.mm',start+4000,4000,false);expect(r.state().opens).toHaveLength(1);expect(r.engine.data.notices).toHaveLength(0);});
 it('requires a reason outside allowed windows and respects weekday overrides',()=>{const r=runtime();const s=r.state();r.call('save',{state:{...s,rules:s.rules.map(x=>({...x,allowedWindows:[{days:[1],start:1200,end:1380}],weekdays:{1:{dailyMinutes:20,dailyOpens:3}}}))}},start,0);const notice=r.tick('com.tencent.mm',start+1000,1000,false).notice!;expect(notice.decision.reason).toBe('outside-window');expect(()=>r.call('allow',{id:notice.id,reason:''},start+2000,2000)).toThrow();});
 it('settles focus exactly once, supports count-up and keeps original Android package identities',()=>{const r=runtime();r.call('focus_start',{minutes:1},start,0);r.tick(null,start+61000,61000,false);r.tick(null,start+62000,62000,false);expect(r.state().sessions.filter(s=>s.status==='completed')).toHaveLength(1);r.call('focus_start',{minutes:25,countUp:true},start+63000,63000);r.call('focus_finish',{id:`focus:${start+63000}`},start+124000,124000);expect(r.state().sessions.filter(s=>s.status==='completed')).toHaveLength(2);expect(r.state().targets.map(t=>t.identities[0])).toEqual(androidApps.map(a=>a.pkg));});
 it('starts managed focus on WeChat before its daily quota is exhausted',()=>{
  const r=new AndroidRuntime(null);r.call('first_rule',{targetId:'wechat',minutes:30},start,0);
  const result=r.call('focus_start',{minutes:25,manage:true,targetIds:['wechat']},start,0);
  expect(result.enabled).toBe(true);r.tick('cn.liubai.app.preview2',start+100,100,false);
  const tick=r.tick('com.tencent.mm',start+1000,1000,false);
  expect(tick.notice?.decision.reason).toBe('focus');expect(tick.overlayNotice?.targetId).toBe('wechat');
  expect(r.state().opens).toHaveLength(1);
  expect(r.tick('tv.danmaku.bili',start+2000,2000,false).overlayNotice).toBeNull();
 });
 it('timer-only focus never activates management or adds a focus app restriction',()=>{
  const r=new AndroidRuntime(null);r.call('first_rule',{targetId:'wechat',minutes:30},start,0);
  const result=r.call('focus_start',{minutes:25,manage:false,targetIds:[]},start,0);
  expect(result.enabled).toBe(false);expect(result.state.sessions.at(-1)?.listIds).toEqual([]);
  r.call('management',{enabled:true},start+100,100);r.tick('cn.liubai.app.preview2',start+100,100,false);
  expect(r.tick('com.tencent.mm',start+1000,1000,false).overlayNotice).toBeNull();
 });
 it('rejects empty or unknown focus targets without starting or enabling management',()=>{
  const r=new AndroidRuntime(null);
  for(const targetIds of [[],['unknown']])expect(()=>r.call('focus_start',{minutes:25,manage:true,targetIds},start,0)).toThrow();
  expect(r.engine.data.enabled).toBe(false);expect(r.state().sessions).toHaveLength(0);
 });
 it('keeps focus selections after a policy edit and restart',()=>{
  const r=runtime();r.call('focus_start',{minutes:25,manage:true,targetIds:['wechat','xiaohongshu-app']},start,0);
  r.call('save',{state:r.state()},start+100,100);const reopened=new AndroidRuntime(r.snapshot());
  const session=reopened.state().sessions.at(-1)!;
  expect(reopened.state().lists.filter(l=>session.listIds.includes(l.id)).flatMap(l=>l.targetIds)).toEqual(['wechat','xiaohongshu-app']);
 });

});

describe('Android desktop feature parity',()=>{
 it('keeps edited lists, projects and friction rules across save and restart',()=>{const r=runtime();r.call('patch',{patch:{lists:[...r.state().lists,{id:'custom',name:'学习',targetIds:['wechat']}],rules:r.state().rules.map(x=>({...x,mode:'friction'}))}},start,0);const restored=new AndroidRuntime(r.snapshot());expect(restored.state().lists.find(l=>l.id==='custom')?.targetIds).toEqual(['wechat']);expect(restored.state().rules[0].mode).toBe('friction');});
 it('merges independent background and settings patches without losing the uploaded asset',()=>{const r=runtime();r.call('patch',{patch:{focusBackgrounds:[{id:'photo',name:'照片',dataUrl:'data:image/png;base64,AAAA'}]}},start,0);r.call('patch',{patch:{settings:{focusBackgroundId:'photo',focusTone:'rose'}}},start,0);expect(r.state().focusBackgrounds).toHaveLength(1);expect(r.state().settings.focusBackgroundId).toBe('photo');expect(r.state().settings.timezone).toBeTruthy();});
 it('starts saved scene with its project, background, selection and timer mode',()=>{const r=runtime();const space={id:'read',name:'阅读',durationMinutes:40,mode:'gentle',tone:'blue',projectId:'personal',listIds:['social'],timerMode:'countup',backgroundId:'photo'};r.call('patch',{patch:{focusSpaces:[space]}},start,0);r.call('space_start',{id:'read',manage:true},start+100,100);const session=r.state().sessions.at(-1)!;expect(session).toMatchObject({spaceName:'阅读',spaceTone:'blue',timerMode:'countup',backgroundId:'photo',listIds:['social'],projectId:'personal'});expect(r.tick('com.tencent.mm',start+1000,1000,false).notice?.decision.reason).toBe('focus');});
 it('starts schedule at its starting minute, includes selected apps immediately and does not repeat',()=>{const r=runtime();const space={id:'slot',name:'晨读',durationMinutes:40,mode:'gentle',tone:'mint',projectId:'personal',listIds:['social']};const schedule={id:'schedule',name:'晨读',enabled:true,mode:'gentle',listIds:['social'],focusSpace:space,windows:[{days:[1],start:540,end:580}]};r.call('patch',{patch:{schedules:[schedule]}},start,0);expect(r.tick('com.tencent.mm',start+1000,1000,false).notice?.decision.reason).toBe('focus');r.tick('com.tencent.mm',start+2000,2000,false);expect(r.state().sessions).toHaveLength(1);expect(r.state().sessions[0].endsAt).toBe(start+40*60000);});
 it('enforces the real 30-second challenge before granting friction access',()=>{const r=runtime();r.call('patch',{patch:{rules:r.state().rules.map(x=>({...x,mode:'friction',dailyOpens:0}))}},start,0);const n=r.tick('com.tencent.mm',start+1000,1000,false).notice!;const args={id:n.id,typed:'我确认这次打开有明确目的',reason:'回复必要消息',intention:'intentional'};expect(()=>r.call('allow',args,start+2000,2000)).toThrow();r.call('allow',args,start+31000,31000);expect(r.engine.data.notices).toHaveLength(0);});
 it('records leaving an accidental over-quota opening without granting access',()=>{const r=runtime();r.call('patch',{patch:{rules:r.state().rules.map(x=>({...x,dailyOpens:0}))}},start,0);const n=r.tick('com.tencent.mm',start+1000,1000,false).notice!;r.call('leave',{id:n.id,reason:'无意识打开',intention:'accidental'},start+2000,2000);expect(r.state().opens[0].intention).toBe('accidental');expect(r.engine.data.notices).toHaveLength(0);expect(r.engine.data.grants).toEqual({});expect(r.state().openReasons[0].text).toBe('无意识打开');});
 it('keeps focus cancellation challenge authoritative in native runtime',()=>{const r=runtime();r.call('focus_start',{minutes:25,mode:'friction'},start,0);const id=r.state().sessions[0].id;r.call('focus_cancel_begin',{id},start+1000,1000);const args={id,typed:'我确认这次打开有明确目的',reason:'需要处理紧急事情'};expect(()=>r.call('focus_cancel',args,start+2000,2000)).toThrow();r.call('focus_cancel',args,start+32000,32000);expect(r.state().sessions[0].status).toBe('cancelled');});
 it('restores historical data locally with management disabled and rejects import during active focus',()=>{const r=runtime();r.tick('com.tencent.mm',start+1000,1000,false);const backup=structuredClone(r.state());const result=r.call('restore',{state:backup},start+2000,2000);expect(result.enabled).toBe(false);expect(r.state().opens).toHaveLength(1);r.call('focus_start',{minutes:25,manage:false},start+3000,3000);expect(()=>r.call('restore',{state:backup},start+4000,4000)).toThrow();});
});
