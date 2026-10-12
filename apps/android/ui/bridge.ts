import type {AppState} from '../../../packages/core/src/model';
import type {NativeNotice} from '../../../packages/core/src/native-engine';
export type Result={state:AppState;enabled:boolean;notice:NativeNotice|null;monotonicMs:number;cancelStarted?:Record<string,number>};
declare global {interface Window{Android?:{request:(id:number,method:string,json:string)=>void};nativeReply:(id:number,result:any)=>void}}
let serial=0;const replies=new Map<number,{resolve:(r:any)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
window.nativeReply=(id,result)=>{const p=replies.get(id);if(!p)return;replies.delete(id);clearTimeout(p.timer);result.error?p.reject(Error(result.error)):p.resolve(result);};
export function request<T=Result>(method:string,args:unknown={}):Promise<T>{return new Promise((resolve,reject)=>{if(!window.Android){reject(Error('请在安卓安装包中打开此页面'));return;}const id=++serial;replies.set(id,{resolve,reject,timer:setTimeout(()=>{replies.delete(id);reject(Error('本地服务未响应，请重新打开留白'));},['pick_image','pick_backup','export_backup'].includes(method)?300000:15000)});window.Android.request(id,method,JSON.stringify(args));});}
export async function pickImage(){const r=await request<{dataUrl:string;name:string;mime:string}>('pick_image');const bytes=Uint8Array.from(atob(r.dataUrl.split(',')[1]),c=>c.charCodeAt(0));return new File([bytes],r.name,{type:r.mime});}
