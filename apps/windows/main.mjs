import {app,BrowserWindow,ipcMain,Tray,Menu,nativeImage,shell,dialog} from 'electron';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {createServer} from 'node:net';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {WindowsController} from './controller.ts';
const here=dirname(fileURLToPath(import.meta.url));
const smoke=process.argv.includes('--smoke-test');
if(smoke)app.setPath('userData',join(app.getPath('temp'),'liubai-smoke-'+process.pid));
else app.setPath('userData',join(app.getPath('appData'),'Liubai'));
let window,tray,helper,server,controller,db,quitting=false,lastState='',sequence=0,lastDisk='',sampledMono=0;
const pending=new Map();let queue=Promise.resolve();
function serial(task){const next=queue.then(task);queue=next.catch(()=>{});return next;}
function native(kind,args={}){return new Promise((resolve,reject)=>{
 if(!helper||helper.killed)return reject(Error('系统连接未就绪'));
 const id=String(++sequence);const timeout=setTimeout(()=>{pending.delete(id);reject(Error('系统连接超时'));},5000);
 pending.set(id,{resolve,reject,timeout});helper.stdin.write(JSON.stringify({id,kind,...args})+'\n');
});}
function show(){window?.show();window?.focus();}
function publish(){if(!controller||!window||window.isDestroyed())return;
 const state=JSON.stringify(controller.engine.policy());if(state!==lastState){window.webContents.send('liubai:state',JSON.parse(state));lastState=state;}
 const status=controller.status();window.webContents.send('liubai:status',status);
 tray?.setToolTip(status.menuBar.detail);tray?.setContextMenu(Menu.buildFromTemplate([{label:status.menuBar.detail,enabled:false},{label:'显示留白',click:show},{type:'separator'},{label:'退出留白（停止应用限制）',click:()=>app.quit()}]));
}
function browserServer(resources){
 const token=randomBytes(32).toString('hex'),pipe='liubai-'+randomBytes(16).toString('hex');
 server=createServer(socket=>{let data=Buffer.alloc(0);socket.setTimeout(5000,()=>socket.destroy());socket.on('error',()=>{});socket.on('data',chunk=>{
 data=Buffer.concat([data,chunk]);if(data.length>65540){socket.destroy();return;}if(data.length<4)return;const n=data.readUInt32LE(0);if(n<1||n>65536){socket.destroy();return;}if(data.length<n+4)return;socket.pause();
 void serial(()=>{let result;try{const payload=JSON.parse(data.subarray(4,n+4));const supplied=Buffer.from(String(payload.token??''));const expected=Buffer.from(token);if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))throw Error('连接凭证无效');result=controller.browser(payload.request);publish();}catch(error){result={error:String(error)};}
 const response=Buffer.from(JSON.stringify(result)),header=Buffer.alloc(4);header.writeUInt32LE(response.length);socket.end(Buffer.concat([header,response]));});
 });});
 server.on('error',error=>{controller.lastError='浏览器连接失败：'+String(error);publish();});
 server.listen('\\\\.\\pipe\\'+pipe,()=>{writeFileSync(join(app.getPath('userData'),'browser-endpoint.json'),JSON.stringify({pipe,token}));});
}
async function setup(){
 const resources=app.isPackaged?process.resourcesPath:join(here,'resources');
 mkdirSync(app.getPath('userData'),{recursive:true});
 db=new DatabaseSync(join(app.getPath('userData'),'native.sqlite3'));
 db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS native_state(id INTEGER PRIMARY KEY CHECK(id=1),json TEXT NOT NULL)');
 const row=db.prepare('SELECT json FROM native_state WHERE id=1').get();
 controller=new WindowsController(row?.json??null,{perform:(kind,process)=>native(kind,{process}),show},raw=>{if(raw===lastDisk)return;db.prepare('INSERT INTO native_state(id,json) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json').run(raw);lastDisk=raw;});
 const helperPath=join(resources,'native','Liubai.Native.exe');
 helper=spawn(helperPath,[],{stdio:['pipe','pipe','pipe'],windowsHide:true});
 helper.on('error',error=>{controller.fail(error);publish();});helper.on('exit',()=>{for(const p of pending.values()){clearTimeout(p.timeout);p.reject(Error('系统连接已关闭'));}pending.clear();if(!quitting){controller.fail('系统后台已退出，请重启留白');publish();}});
 helper.stderr.on('data',()=>{});
 createInterface({input:helper.stdout}).on('line',line=>{try{const message=JSON.parse(line);if(message.type==='response'){const p=pending.get(message.id);if(p){clearTimeout(p.timeout);pending.delete(message.id);message.error?p.reject(Error(message.error)):p.resolve(message.result);}return;}
 if(message.type==='observation'){sampledMono=performance.now();void serial(async()=>{await controller.tick(message.data);publish();}).catch(error=>{controller.fail(error);publish();});}else if(message.error)controller.fail(message.error);
 }catch(error){controller.fail(error);}});
 const page=join(here,'web','index.html');const pageURL=pathToFileURL(page).href;
 window=new BrowserWindow({width:1280,height:900,minWidth:860,minHeight:680,title:'留白',show:false,icon:join(resources,'brand','256x256.png'),webPreferences:{preload:join(here,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
 window.setMenuBarVisibility(false);
 window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',(event,url)=>{if(url!==pageURL)event.preventDefault();});
 window.webContents.session.setPermissionRequestHandler((_web,_permission,callback)=>callback(false));
 window.on('close',event=>{if(!quitting){event.preventDefault();window.hide();}});
 window.webContents.on('did-finish-load',()=>{lastState='';publish();if(!smoke)show();});
 ipcMain.handle('liubai:call',(event,method,args={})=>{
 if(event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame||event.senderFrame.url!==pageURL)throw Error('拒绝未知来源');
 return serial(async()=>{
 if(method==='install_browser_host'){
  if(!['edge','chrome'].includes(args.browser))throw Error('请选择 Chrome 或 Edge');
  const id=readFileSync(join(resources,'extension','extension-id.txt'),'utf8').trim();if(!/^[a-p]{32}$/.test(id))throw Error('扩展标识无效');
  const manifestPath=join(app.getPath('userData'),'browser-host.json');
  writeFileSync(manifestPath,JSON.stringify({name:'local.liubai.browser',description:'留白本地网页配额连接',path:helperPath,type:'stdio',allowed_origins:[`chrome-extension://${id}/`]}));
  // Chrome passes only the origin as an argument, so use a dedicated host executable mode.
  await native('register',{browser:args.browser,path:manifestPath});return '本地连接已准备，请加载或重新加载留白扩展';
 }
 if(method==='open_extension_folder'){const error=await shell.openPath(join(resources,'extension'));if(error)throw Error(error);return 'ok';}
 const result=await controller.call(method,args);publish();return result;
 });
 });
 tray=new Tray(nativeImage.createFromPath(join(resources,'brand','32x32.png')));tray.on('click',show);publish();browserServer(resources);
 await window.loadFile(page);
 controller.installed=await native('installed');publish();
 setInterval(()=>{if(performance.now()-sampledMono>5000){controller.fail('系统采样中断，请重启留白');publish();}},3000).unref();
 setInterval(()=>{native('installed').then(apps=>{controller.installed=apps;}).catch(()=>{});},60000).unref();
 if(smoke){await new Promise(resolve=>setTimeout(resolve,2500));const result=await window.webContents.executeJavaScript("({bridge:!!window.liubaiNative,ready:!!document.querySelector('.sidebar')})");if(!result.bridge||!result.ready||!controller.observation.at)throw Error('Windows 界面或系统采样冒烟测试失败');const status=await window.webContents.executeJavaScript("window.liubaiNative.call('native_status')");if(status.platform!=='Windows'||status.lastError)throw Error('Windows IPC 状态校验失败：'+JSON.stringify(status));console.log('PASS: Windows renderer, IPC, SQLite and real Win32 observations');app.quit();}
}
if(!app.requestSingleInstanceLock())app.quit();else{
 app.on('second-instance',show);app.on('window-all-closed',()=>{});
 app.on('before-quit',()=>{quitting=true;try{controller?.commit();}catch{}helper?.stdin.end();server?.close();db?.close();});
 app.whenReady().then(setup).catch(error=>{if(!smoke)dialog.showErrorBox('留白启动失败',String(error));else console.error(error);app.exit(1);});
}
