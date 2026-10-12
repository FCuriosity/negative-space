import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {request,type Result} from './bridge';
import {Reminder} from './Reminder';
import '../../desktop/src/styles.css';
import './mobile.css';
function Overlay(){const [result,setResult]=useState<Result|null>(null),[error,setError]=useState('');useEffect(()=>{let live=true,pending=false;const refresh=async()=>{if(pending)return;pending=true;try{const r=await request('load');if(live)setResult(r);}catch(e){if(live)setError(String(e));}finally{pending=false;}};void refresh();const timer=setInterval(refresh,700);return()=>{live=false;clearInterval(timer);};},[]);return result?.notice?<Reminder key={`${result.notice.id}:${result.notice.openEventId}`} result={result} run={async(method,args)=>{const r=await request(method,args);if(r.state)setResult(r);return r;}}/>:<div className="reminder-paper"><p>{error||'正在准备这次提醒'}</p><button onClick={()=>void request('open_app')}>打开留白</button></div>;}
document.body.classList.add('overlay-surface');createRoot(document.getElementById('root')!).render(<Overlay/>);
