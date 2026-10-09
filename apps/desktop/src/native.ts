import type { AppState } from '../../../packages/core/src';
import type { NativeNotice } from '../../../packages/core/src/native-engine';
import { parseState } from '../../../packages/core/src/state';
export interface NativeStatus { enabled: boolean; browserConnected?:boolean; browserLastSeen?:number; connectedBrowsers?:('chrome'|'edge')[]; notices: NativeNotice[]; installedApps: { name: string; bundleId: string; path?: string; installed: boolean; running?: boolean; processName?: string }[]; platform: string; lastError: string; frontApp: string; idleSeconds: number; sampledAt: number; monotonicMs: number }
declare global { interface Window { liubaiNative?:{platform:'Windows';call<T>(method:string,args:Record<string,unknown>):Promise<T>;subscribe(callback:(name:string,data:unknown)=>void):()=>void}; webkit?: { messageHandlers?: { liubai?: { postMessage(body: unknown): Promise<unknown> } } } } }
export const nativeMac=!!window.webkit?.messageHandlers?.liubai;
export const nativeWindows=!!window.liubaiNative;
export const nativeDesktop=nativeMac||nativeWindows;
window.liubaiNative?.subscribe((name,data)=>window.dispatchEvent(new CustomEvent(name,{detail:data})));
export async function callNative<T>(method: string,args: Record<string,unknown>={}): Promise<T> {
  if(window.liubaiNative)return window.liubaiNative.call<T>(method,args);
  const handler=window.webkit?.messageHandlers?.liubai;
  if(!handler) throw new Error('请在留白桌面应用中使用此功能');
  return await handler.postMessage({method,...args}) as T;
}
let lastInbound='';
const nativeSnapshots=new WeakSet<AppState>();
export function markNativeState(state: AppState) { nativeSnapshots.add(state); lastInbound=JSON.stringify(state); }
export function isInbound(state: AppState) { return nativeSnapshots.has(state) || JSON.stringify(state)===lastInbound; }
export function observeNativeState(callback: (state: AppState)=>void) {
  const listener=(event: Event) => { const state=parseState((event as CustomEvent).detail); markNativeState(state); callback(state); };
  window.addEventListener('liubai:state',listener);
  return () => window.removeEventListener('liubai:state',listener);
}
