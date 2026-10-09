import type { AppState } from '../../../packages/core/src';
import type { NativeNotice } from '../../../packages/core/src/native-engine';
import { parseState } from '../../../packages/core/src/state';
export interface NativeStatus { enabled: boolean; browserConnected?:boolean; browserLastSeen?:number; notices: NativeNotice[]; installedApps: { name: string; bundleId: string; path?: string; installed: boolean }[]; platform: string; lastError: string; frontApp: string; idleSeconds: number; sampledAt: number; monotonicMs: number }
declare global { interface Window { webkit?: { messageHandlers?: { liubai?: { postMessage(body: unknown): Promise<unknown> } } } } }
export const nativeMac=!!window.webkit?.messageHandlers?.liubai;
export async function callMac<T>(method: string,args: Record<string,unknown>={}): Promise<T> {
  const handler=window.webkit?.messageHandlers?.liubai;
  if(!handler) throw new Error('请在留白 Mac 应用中使用此功能');
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
