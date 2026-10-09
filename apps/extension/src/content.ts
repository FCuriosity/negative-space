import { BrowserPolicySchema, defaultBrowserPolicy, resolvePage,hostMatches } from '../../../packages/core/src/browser';
import {CHALLENGE_TEXT} from '../../../packages/core/src/rules';
import {reasonLabels,type Decision} from '../../../packages/core/src/model';
let policy=defaultBrowserPolicy;
let response:{enabled?:boolean;decision?:Decision;waitSeconds?:number;error?:string;inactive?:boolean}={error:'正在检查留白连接…'};
const style=document.createElement('style');style.id='liubai-filter-style';
const host=document.createElement('div');host.id='liubai-block-screen';
const shadow=host.attachShadow({mode:'closed'});
shadow.innerHTML=`<style>:host{all:initial;position:fixed!important;inset:0!important;z-index:2147483647!important;background:#f2f1ec!important;display:grid!important;place-items:center!important;font-family:system-ui;color:#202d2e}.card{max-width:470px;padding:40px;text-align:center}h1{font-size:28px;font-weight:600}p{font-size:14px;line-height:1.9;color:#455657}button{background:#a33d28;color:white;border:0;border-radius:8px;padding:12px 25px;font-size:14px;cursor:pointer}button:disabled{background:#dce2da;color:#4c5e52;opacity:1}button:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid #266a85;outline-offset:3px}label{display:block;text-align:left;font-size:13px;margin:16px 0 8px}textarea,input{box-sizing:border-box;width:100%;padding:12px;border:1px solid #899693;border-radius:8px;background:white;font:14px system-ui}small{display:block;margin:16px 0;color:#596768}.actions{display:flex;gap:12px;justify-content:center;margin-top:18px}.secondary{background:#e3eae3;color:#25483b}[hidden]{display:none!important}</style><section class="card" role="dialog" aria-modal="true" aria-labelledby="heading"><p>留 白 · LIUBAI</p><h1 id="heading">打开之前，停一下</h1><p id="description"></p><form hidden><label for="reason">这次打开网页的理由</label><textarea id="reason" maxlength="300" rows="3" placeholder="例如：查阅一个具体问题的答案"></textarea><div id="challenge"><label for="typed"></label><input id="typed" autocomplete="off"></div><small id="wait"></small><button type="submit" id="allow">继续使用 5 分钟</button></form><p id="error" role="alert"></p><div class="actions"><button class="secondary" id="back">返回上一页</button></div><small>规则在留白 Mac 应用中调整当前网页保留，放行后可继续使用</small></section>`;
const get=<T extends Element>(s:string)=>shadow.querySelector<T>(s)!;
get('#back').addEventListener('click',()=>{if(history.length>1)history.back();else location.href='about:blank';});
get('form').addEventListener('submit',async e=>{e.preventDefault();const button=get<HTMLButtonElement>('#allow');button.disabled=true;try{const result=await chrome.runtime.sendMessage({type:'liubai-allow',typed:get<HTMLInputElement>('#typed').value,reason:get<HTMLTextAreaElement>('#reason').value});if(result.error)get('#error').textContent=result.error;else get('#error').textContent='';await poll();}catch{get('#error').textContent='连接中断，请确认留白正在运行';}finally{button.disabled=false;}});
const inertBefore=new Map<HTMLElement,boolean>();
function guardPage(blocked:boolean){
  if(blocked){for(const node of Array.from(document.documentElement.children)){if(node instanceof HTMLElement&&node!==host&&node.tagName!=='HEAD'){if(!inertBefore.has(node))inertBefore.set(node,node.inert);node.inert=true;}}}
  else{for(const [node,value]of inertBefore)node.inert=value;inertBefore.clear();}
}
document.addEventListener('keydown',event=>{if(host.isConnected&&event.target!==host){event.preventDefault();event.stopImmediatePropagation();get<HTMLButtonElement>('#back').focus();}},true);
function apply(){
  if(!document.documentElement)return;
  const local=resolvePage(location.href,policy);
  const managedDefault=['zhihu.com','xiaohongshu.com'].some(d=>hostMatches(location.hostname,d));
  const disconnected=!!response.error;
  const blocked=local.blocked || (disconnected&&managedDefault) || (!!response.enabled&&!!response.decision&&response.decision.action!=='allow');
  const css=local.selectors.map(selector=>`${selector}{display:none!important}`).join('\n');if(style.textContent!==css)style.textContent=css;if(!style.isConnected)document.documentElement.append(style);
  if(blocked&&!host.isConnected){document.documentElement.append(host);get<HTMLButtonElement>('#back').focus();}if(!blocked&&host.isConnected)host.remove();guardPage(blocked);
  const decision=response.decision;
  get('#description').textContent=local.blocked?'这个页面在你的网页屏蔽列表中':disconnected?response.error!:decision?.reason?reasonLabels[decision.reason]:'这个页面暂时受到限制';
  const canAsk=!local.blocked&&!disconnected&&!!response.enabled&&(decision?.mode==='gentle'||decision?.mode==='friction');
  get<HTMLElement>('form').hidden=!canAsk;get<HTMLElement>('#challenge').hidden=decision?.mode!=='friction';get('#challenge label').textContent=`请输入：${CHALLENGE_TEXT}`;
  const wait=response.waitSeconds??0;get('#wait').textContent=wait>0?`等待 ${wait} 秒，再做一次主动选择`:'填写理由后，可以临时使用 5 分钟';get<HTMLButtonElement>('#allow').disabled=wait>0;
}
async function poll(){try{const next=await chrome.runtime.sendMessage({type:'liubai-poll'});if(!next.inactive)response=next;}catch{response={error:'扩展连接已断开，请刷新网页并确认留白正在运行'};}apply();}
chrome.runtime.onMessage.addListener(message=>{if(message?.type==='liubai-decision'){response=message;apply();}});
chrome.storage.local.get('policy',result=>{const parsed=BrowserPolicySchema.safeParse(result.policy);if(parsed.success)policy=parsed.data;apply();});
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.policy){const parsed=BrowserPolicySchema.safeParse(changes.policy.newValue);policy=parsed.success?parsed.data:defaultBrowserPolicy;apply();}});
new MutationObserver(()=>{if(document.documentElement&&!host.isConnected)apply();}).observe(document,{childList:true,subtree:true});
document.addEventListener('DOMContentLoaded',apply);document.addEventListener('visibilitychange',()=>void poll());
apply();void poll();setInterval(()=>void poll(),1000);
