const {contextBridge,ipcRenderer}=require('electron');
const methods=new Set(['load_state','save_state','native_status','set_management','save_reflection','save_open_reason','close_opening','finish_countup','classify_opening','allow_app','quit_now','return_to_app','force_quit','install_browser_host','open_extension_folder']);
contextBridge.exposeInMainWorld('liubaiNative',{
 platform:'Windows',
 call:(method,args={})=>{if(!methods.has(method))return Promise.reject(Error('不支持的操作'));return ipcRenderer.invoke('liubai:call',method,args);},
 subscribe:(callback)=>{const state=(_event,data)=>callback('liubai:state',data),status=(_event,data)=>callback('liubai:status',data);ipcRenderer.on('liubai:state',state);ipcRenderer.on('liubai:status',status);return ()=>{ipcRenderer.removeListener('liubai:state',state);ipcRenderer.removeListener('liubai:status',status);};}
});
