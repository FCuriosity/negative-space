import { firstRunSnapshot, NativeEngine, type NativeObservation, type NativeProcess } from '../../packages/core/src/native-engine';
import { mayForceQuit } from '../../packages/core/src/enforcement';
export const appNames: Record<string,string> = {'com.bilibili.bilibiliPC':'哔哩哔哩 App','com.xingin.discover':'小红书 App','com.tencent.xinWeChat':'微信','com.valvesoftware.steam':'Steam'};
export interface SystemPort {
  perform(kind:'quit'|'force'|'activate',process:NativeProcess):Promise<boolean>;
  show():void;
}
export class WindowsController {
  readonly engine:NativeEngine;
  observation:NativeObservation={at:0,monotonicMs:0,idleSeconds:0,locked:false,frontBundleId:null,processes:[]};
  installed:{name:string;bundleId:string;installed:boolean;path?:string}[]=[];
  lastError='';
  private seen:Record<string,number>={};
  private lastSeen=0;
  constructor(raw:string|null,private system:SystemPort,private persist:(raw:string)=>void,private mono=()=>performance.now()) {this.engine=new NativeEngine(raw??firstRunSnapshot());}
  commit(){this.persist(this.engine.serialize());}
  fail(error:unknown){this.lastError=String(error);this.engine.setEnabled(false);try{this.commit();}catch{}}
  async tick(o:NativeObservation){
    this.observation=o;
    const commands=this.engine.tick(o);this.commit();
    for(const c of commands)if(c.kind==='show')this.system.show();else if(!await this.system.perform('quit',c.process))this.lastError='未能请求应用正常关闭，请手动关闭；如果应用以管理员身份运行，请改为普通方式运行';
  }
  status(){
    const connectedBrowsers=Object.keys(this.seen).filter(b=>this.mono()-this.seen[b]<90000);
    return {enabled:this.engine.data.enabled,notices:this.engine.data.notices,installedApps:Object.entries(appNames).map(([bundleId,name])=>{const saved=this.installed.find(a=>a.bundleId===bundleId),running=this.observation.processes.find(p=>p.bundleId===bundleId);return {name,bundleId,installed:!!running||!!saved?.installed,path:running?.executable??saved?.path,running:!!running,processName:running?.executable.split(/[\\/]/).pop()};}),platform:'Windows',lastError:this.lastError,frontApp:appNames[this.observation.frontBundleId??'']??'其他应用',idleSeconds:this.observation.idleSeconds,sampledAt:Date.now(),monotonicMs:this.observation.monotonicMs,browserConnected:!!connectedBrowsers.length,connectedBrowsers,browserLastSeen:this.lastSeen,menuBar:this.engine.menuBar(Date.now())};
  }
  private async activate(targetId:string){
    const target=this.engine.policy().targets.find(t=>t.id===targetId);
    const process=this.observation.processes.find(p=>target?.identities.includes(p.bundleId));
    if(process){this.engine.prepareReturn(process);await this.system.perform('activate',process);}
  }
  async call(method:string,args:Record<string,unknown>={}){
    const now=Date.now();const e=this.engine;
    const text=(key:string,max=10000)=>{const v=args[key];if(typeof v!=='string'||v.length>max)throw Error('参数不正确：'+key);return v;};
    const state=()=>JSON.stringify(e.policy());
    switch(method){
      case 'load_state':return state();
      case 'native_status':return this.status();
      case 'save_state':e.updatePolicy(text('json',10000000),now);break;
      case 'set_management':if(typeof args.enabled!=='boolean')throw Error('开关参数不正确');e.setEnabled(args.enabled);this.lastError='';this.commit();return this.status();
      case 'finish_countup':e.finishCountUp(text('id'),now);break;
      case 'save_reflection':e.saveReflection(text('id'),text('text'),now);break;
      case 'classify_opening':e.classifyOpening(text('id'),text('intention'));break;
      case 'save_open_reason':{
        const id=text('id');e.saveOpenReason(id,text('text'),now,args.skip===true,args.intention as string|undefined);this.commit();
        const event=e.policy().opens.find(o=>o.id===id);if(args.returnToApp===true&&event)await this.activate(event.targetId);return state();
      }
      case 'close_opening':{
        const id=text('id'),reason=text('text',300);
        const process=e.closeOpeningProcess(id,reason,now,this.observation.processes);
        if(!await this.system.perform('quit',process))throw Error('未能请求正常关闭，请保存工作后手动关闭应用');
        e.recordClosedOpening(id,reason,now);this.commit();return state();
      }
      case 'allow_app':{
        const id=e.allow(text('noticeId'),now,this.observation.monotonicMs,text('typed'),text('reason',300),args.intention as string|undefined);
        this.commit();await this.activate(id);return this.status();
      }
      case 'quit_now':case 'return_to_app':case 'force_quit':{
        const notice=e.data.notices.find(n=>n.id===text('noticeId'));if(!notice)throw Error('应用状态已变化');
        const p=this.observation.processes.find(p=>p.pid===notice.quit.process.pid&&p.startedAt===notice.quit.process.startedAt&&p.executable===notice.quit.process.executable);
        if(!p)throw Error('进程已变化，请刷新');
        if(method==='force_quit'&&!mayForceQuit(notice.quit,p,args.confirmed===true))throw Error('未获准强制退出');
        if(method==='return_to_app')e.prepareReturn(p);
        const requested=await this.system.perform(method==='force_quit'?'force':method==='quit_now'?'quit':'activate',p);
        if(!requested)throw Error('操作未完成，请手动处理；如果应用以管理员身份运行，请改为普通方式运行');
        return {requested};
      }
      default:throw Error('不支持的操作');
    }
    this.commit();return state();
  }
  browser(request:Record<string,unknown>){
    const {browser,host,visit,operation}=request;
    if((browser!=='edge'&&browser!=='chrome')||typeof host!=='string'||host.length>253||!/^[a-z0-9.-]*$/.test(host)||typeof visit!=='string'||visit.length>100)throw Error('浏览器消息格式无效');
    this.seen[browser]=this.mono();this.lastSeen=Date.now();
    if(operation==='heartbeat')return {connected:true,enabled:this.engine.data.enabled};
    const expected=browser==='edge'?'com.microsoft.edgemac':'com.google.Chrome';
    if(this.observation.frontBundleId!==expected||request.active!==true||Date.now()-this.observation.at>5000)return {inactive:true,enabled:this.engine.data.enabled};
    const o={host,visit,active:true,at:Date.now(),monotonicMs:this.observation.monotonicMs,idleSeconds:this.observation.idleSeconds,locked:this.observation.locked};
    let result=this.engine.observeWebsite(o);
    if(operation==='allow'&&result.targetId){this.engine.allowWebsite(result.targetId,o.at,o.monotonicMs,String(request.typed??''),String(request.reason??''));result=this.engine.observeWebsite(o);}
    this.commit();return result;
  }
}
