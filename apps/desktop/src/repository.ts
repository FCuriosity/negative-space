import { invoke, isTauri } from '@tauri-apps/api/core';
import type { AppState, StateRepository } from '../../../packages/core/src';
import { parseState } from '../../../packages/core/src/state';
import { callMac, nativeMac, markNativeState, isInbound } from './native';
const KEY = 'liubai.state.v1';
export const native = isTauri() || nativeMac;
export const repository: StateRepository = {
  async load() {
    if(nativeMac) { const result=parseState(JSON.parse(await callMac<string>('load_state'))); markNativeState(result); return result; }
    const raw = native ? await invoke<string | null>('load_state') : localStorage.getItem(KEY);
    return raw === null ? null : parseState(JSON.parse(raw));
  },
  async save(state) {
    if(nativeMac) { if(!isInbound(state)) { const result=await callMac<string>('save_state',{json:JSON.stringify(parseState(state))}); markNativeState(parseState(JSON.parse(result))); } return; }
    const json = JSON.stringify(parseState(state));
    if (native) await invoke('save_state', { json }); else localStorage.setItem(KEY, json);
  },
};
export function downloadData(state: AppState) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = '留白-本地备份.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
