import { registerBrowserHeartbeat } from './heartbeat';
import {hostMatches} from '../../../packages/core/src/browser';
const browser=navigator.userAgent.includes('Edg/')?'edge':'chrome';
const domains=['bilibili.com','youtube.com','weibo.com','zhihu.com','douyin.com','xiaohongshu.com'];
let running=false;
let latest:Record<string,unknown>={error:'尚未连接留白桌面应用'};
let currentTab=-1;
let currentHost='';
async function report(operation='observe',extra:Record<string,unknown>={}) {
  if(running)return latest;
  running=true;
  try {
    const tabs=await chrome.tabs.query({active:true,lastFocusedWindow:true});const tab=tabs[0];
    const window=tab?.windowId!==undefined?await chrome.windows.get(tab.windowId):null;
    let host='';try{host=new URL(tab?.url??'').hostname;}catch{}
    if(!domains.some(d=>hostMatches(host,d)))host='';
    currentTab=tab?.id??-1;currentHost=host;
    latest=await chrome.runtime.sendNativeMessage('local.liubai.browser',{host,browser,visit:`${navigator.userAgent.includes('Edg/')?'edge':'chrome'}:${tab?.windowId??0}:${currentTab}`,active:!!window?.focused,operation,...extra}) as Record<string,unknown>;
    await chrome.storage.local.set({connection:{ok:!latest.error,at:Date.now(),error:latest.error??'',enabled:latest.enabled??false}});
    if(currentTab>=0&&host&&!latest.inactive)await chrome.tabs.sendMessage(currentTab,{type:'liubai-decision',...latest}).catch(()=>{});
  }catch(e){latest={error:'浏览器还没有连接留白请在留白的“浏览器管理”中完成连接，并保持留白运行'};await chrome.storage.local.set({connection:{ok:false,at:Date.now(),error:String(e)}});}
  finally{running=false;}
  return latest;
}
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message?.type==='liubai-poll') {
    // Only the actual selected tab can change foreground statistics.
    report().then(result=>reply(sender.tab?.id===currentTab?result:{inactive:true}));return true;
  }
  if(message?.type==='liubai-allow' && sender.tab?.id===currentTab && currentHost) {report('allow',{typed:String(message.typed??'').slice(0,200),reason:String(message.reason??'').slice(0,301)}).then(reply);return true;}
  if(message?.type==='liubai-status'){report().then(reply);return true;}
});
chrome.tabs.onActivated.addListener(()=>void report());
chrome.windows.onFocusChanged.addListener(()=>void report());
chrome.tabs.onUpdated.addListener((id,change)=>{if(id===currentTab&&change.url)void report();});
// Connection liveness must not depend on managed pages or throttled content timers.
registerBrowserHeartbeat(async()=>{
  try {
    const result=await chrome.runtime.sendNativeMessage('local.liubai.browser',{operation:'heartbeat',browser,host:'',visit:'heartbeat',active:false}) as Record<string,unknown>;
    await chrome.storage.local.set({connection:{ok:!result.error,at:Date.now(),error:result.error??'',enabled:result.enabled??false}});
  } catch(e) {
    await chrome.storage.local.set({connection:{ok:false,at:Date.now(),error:String(e)}});
  }
});
