import { NativeEngine, type NativeObservation } from '../../packages/core/src/native-engine';
let engine: NativeEngine;
export function initialize(raw: string | null) { engine=new NativeEngine(raw); return state(); }
export function state() { return JSON.stringify(engine.policy()); }
export function snapshot() { return engine.serialize(); }
export function tick(observation: NativeObservation) { return JSON.stringify(engine.tick(observation)); }
export function save(raw: string,now: number) { engine.updatePolicy(raw,now); return state(); }
export function setEnabled(value: boolean) { engine.setEnabled(value); return state(); }
export function status(now = Date.now()) { return JSON.stringify({ enabled:engine.data.enabled,notices:engine.data.notices,menuBar:engine.menuBar(now) }); }
export function allow(id: string,now: number,monotonicMs: number,typed: string,reason: string,intention?:string) { return engine.allow(id,now,monotonicMs,typed,reason,intention); }

export function saveReflection(id:string,text:string,now:number) { engine.saveReflection(id,text,now);return state(); }
export function saveOpenReason(id:string,text:string,now:number,skip:boolean,intention?:string) { engine.saveOpenReason(id,text,now,skip,intention);return state(); }

export function prepareReturn(identity:import('../../packages/core/src/native-engine').NativeProcess) { engine.prepareReturn(identity); }

export function classifyOpening(id:string,intention:string) { engine.classifyOpening(id,intention);return state(); }

export function observeWebsite(observation:import('../../packages/core/src/web-quota').WebObservation) {return JSON.stringify(engine.observeWebsite(observation));}

export function allowWebsite(id:string,now:number,mono:number,typed:string,reason:string) {engine.allowWebsite(id,now,mono,typed,reason);}

export function finishCountUp(id:string,now:number){engine.finishCountUp(id,now);return state();}

export function closeOpeningProcess(id:string,text:string,now:number,processes:import('../../packages/core/src/native-engine').NativeProcess[]) {return JSON.stringify(engine.closeOpeningProcess(id,text,now,processes));}
export function recordClosedOpening(id:string,text:string,now:number) {engine.recordClosedOpening(id,text,now);return state();}
