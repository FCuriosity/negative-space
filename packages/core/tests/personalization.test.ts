import { describe,it,expect } from 'vitest';
import { initialState } from '../src/seed';
import { parseState } from '../src/state';
import { DEFAULT_REASON_TAGS,appendReasonTag,normalizeReasonTags } from '../src/reason-tags';
import { startFocus,settleFocus } from '../src/focus';
import { NativeEngine } from '../src/native-engine';
import { canOverride,CHALLENGE_TEXT } from '../src/rules';
import type {FocusSession} from '../src/model';
import { mirrorLake } from '../src/mirror-lake';
const now=Date.parse('2026-10-08T10:00:00+08:00');
const session=(minutes:number):FocusSession=>({id:'custom',startedAt:now,endsAt:now+minutes*60000,durationMinutes:minutes,mode:'gentle',projectId:'personal',listIds:[],status:'active'});
describe('Mirror Lake character preference',()=>{
  it('defaults old backups to male and retains an explicit female selection',()=>{
    const old=JSON.parse(JSON.stringify(initialState()));delete old.settings.mirrorLakeCharacterGender;
    expect(parseState(old).settings.mirrorLakeCharacterGender).toBe('male');
    old.settings.mirrorLakeCharacterGender='female';
    expect(parseState(JSON.parse(JSON.stringify(parseState(old)))).settings.mirrorLakeCharacterGender).toBe('female');
  });
  it('rejects unknown character sets at the persistence boundary',()=>{
    const state=initialState();
    expect(()=>parseState({...state,settings:{...state.settings,mirrorLakeCharacterGender:'unknown'}})).toThrow();
  });
  it('persists across native restart without changing lake counts, light or policy',()=>{
    const engine=new NativeEngine();const state=engine.policy();
    engine.updatePolicy(JSON.stringify({...state,sessions:[{...session(25),status:'completed',endedAt:now}]}),now);
    const before=engine.policy();
    engine.updatePolicy(JSON.stringify({...before,settings:{...before.settings,mirrorLakeCharacterGender:'female'}}),now);
    const restored=new NativeEngine(engine.serialize()).policy();
    expect(restored.settings.mirrorLakeCharacterGender).toBe('female');
    expect(mirrorLake(restored,now)).toEqual(mirrorLake(before,now));
    expect(restored.rules).toEqual(before.rules);
    expect(restored.usage).toEqual(before.usage);
    expect(restored.rewards).toEqual(before.rewards);
  });
});
describe('quick reason tags',()=>{
  it('adds defaults to old backups and preserves deliberately empty tag lists',()=>{
    const old=JSON.parse(JSON.stringify(initialState()));delete old.settings.reasonTags;delete old.settings.focusDurationMinutes;
    expect(parseState(old).settings).toMatchObject({reasonTags:DEFAULT_REASON_TAGS,focusDurationMinutes:25});
    old.settings.reasonTags=[];expect(parseState(old).settings.reasonTags).toEqual([]);
  });
  it('deduplicates custom tags and rejects oversized or ambiguous labels',()=>{
    expect(normalizeReasonTags([' 家人 ','家人',''])).toEqual(['家人']);
    expect(()=>normalizeReasonTags(['长'.repeat(17)])).toThrow();
    expect(()=>normalizeReasonTags(['A；B'])).toThrow();
    expect(()=>normalizeReasonTags(Array.from({length:21},(_,i)=>String(i)))).toThrow();
  });
  it('preserves written reasons, prevents repeated chips, and respects text limits',()=>{
    expect(appendReasonTag('','摸鱼')).toBe('摸鱼');
    expect(appendReasonTag('想回复一条消息','摸鱼')).toBe('想回复一条消息；摸鱼');
    expect(appendReasonTag('摸鱼；回复消息','摸鱼')).toBe('摸鱼；回复消息');
    expect(()=>appendReasonTag('字'.repeat(299),'摸鱼')).toThrow();
  });
  it('retains tags after a native restart without creating an opening or reason',()=>{
    const engine=new NativeEngine();const state=engine.policy();
    engine.updatePolicy(JSON.stringify({...state,settings:{...state.settings,reasonTags:['摸鱼','联系家人']}}),now);
    const restored=new NativeEngine(engine.serialize());
    expect(restored.policy().settings.reasonTags).toEqual(['摸鱼','联系家人']);
    expect(restored.policy().opens).toEqual([]);expect(restored.policy().openReasons).toEqual([]);
  });
  it('does not bypass friction requirements with a short reason tag',()=>{
    expect(canOverride('friction',0,30000,CHALLENGE_TEXT,'摸鱼')).toBe(false);
    expect(canOverride('friction',0,29000,CHALLENGE_TEXT,'摸鱼；短暂放松')).toBe(false);
    expect(canOverride('friction',0,30000,CHALLENGE_TEXT,'摸鱼；短暂放松')).toBe(true);
  });
});
describe('custom focus duration',()=>{
  it.each([1,37,135,720])('starts %i minutes with the exact deadline',minutes=>{
    const state=startFocus(initialState(),session(minutes));
    expect(state.sessions[0].endsAt-now).toBe(minutes*60000);
  });
  it.each([0,-1,0.5,721,NaN,Infinity])('rejects invalid duration %s',minutes=>{
    expect(()=>startFocus(initialState(),session(minutes))).toThrow();
  });
  it('remembers the last duration and settles the exact custom session after restart',()=>{
    const engine=new NativeEngine();const state=startFocus(engine.policy(),session(37));state.settings.focusDurationMinutes=37;
    engine.updatePolicy(JSON.stringify(state),now);
    const restored=new NativeEngine(engine.serialize());
    expect(restored.policy().settings.focusDurationMinutes).toBe(37);
    expect(settleFocus(restored.policy(),now+37*60000-1).sessions[0].status).toBe('active');
    expect(settleFocus(restored.policy(),now+37*60000).sessions[0].status).toBe('completed');
  });
  it('rejects invalid new native sessions even when a UI snapshot is submitted directly',()=>{
    const engine=new NativeEngine();
    expect(()=>engine.updatePolicy(JSON.stringify({...engine.policy(),sessions:[session(721)]}),now)).toThrow();
  });
});
