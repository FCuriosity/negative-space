import { describe, expect, it } from 'vitest';
import { menuBarClock, menuBarState } from '../src/menu-bar';
import { NativeEngine, nativeInitialState } from '../src/native-engine';
import type { FocusSession } from '../src/model';
const now = Date.parse('2026-10-09T10:00:00Z');
const focus: FocusSession = {id:'focus',startedAt:now,endsAt:now+1500000,durationMinutes:25,listIds:[],projectId:'personal',mode:'gentle',status:'active'};
const state = () => nativeInitialState();
const breaks = {'bilibili-app':{continuousSeconds:1200,until:now+300000}};

describe('macOS 菜单栏', () => {
  it('常态与暂停都只显示图标，保留可访问的管理状态', () => {
    expect(menuBarState(state(),true,{},now)).toEqual({kind:'idle',title:'',detail:'留白 · 应用管理中'});
    expect(menuBarState(state(),false,breaks,now)).toEqual({kind:'idle',title:'',detail:'留白 · 应用管理已暂停'});
  });
  it('显示真实专注倒计时，专注优先于应用休息，结束或取消后恢复图标', () => {
    const app=state(); app.sessions=[focus];
    expect(menuBarState(app,true,breaks,now+1001).title).toBe('专注 24:59');
    expect(menuBarState(app,true,{},focus.endsAt).kind).toBe('idle');
    app.sessions=[{...focus,status:'cancelled'}];
    expect(menuBarState(app,true,{},now).kind).toBe('idle');
  });
  it('正向计时跨小时，暂停应用管理不暂停已有专注', () => {
    const app=state(); app.sessions=[{...focus,timerMode:'countup',durationMinutes:0,endsAt:now}];
    expect(menuBarState(app,false,{},now+3601500).title).toBe('专注 01:00:01');
    expect(menuBarState(app,false,{},now+3601500).detail).toContain('应用管理已暂停');
    expect(menuBarClock(59)).toBe('00:59');
    expect(menuBarClock(3600)).toBe('01:00:00');
  });
  it('休息按结束时间计算，结束、移除规则或关闭规则后不再显示', () => {
    const app=state();
    expect(menuBarState(app,true,breaks,now+299001).title).toBe('休息 00:01');
    expect(menuBarState(app,true,breaks,now+300000).kind).toBe('idle');
    app.rules=app.rules.map(r=>({...r,enabled:false}));
    expect(menuBarState(app,true,breaks,now).kind).toBe('idle');
    app.rules=[];
    expect(menuBarState(app,true,breaks,now).kind).toBe('idle');
  });
  it('多应用休息显示全部结束的剩余时间，重启后仍读取保存的休息', () => {
    const engine=new NativeEngine(); engine.data.enabled=true;
    engine.data.breaks={...breaks,'xiaohongshu-app':{continuousSeconds:1200,until:now+600000}};
    const restored=new NativeEngine(engine.serialize());
    expect(restored.menuBar(now).title).toBe('休息 10:00');
    expect(restored.menuBar(now).detail).toContain('哔哩哔哩 App、小红书 App');
  });
});
