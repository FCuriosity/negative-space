import {useState,type ChangeEvent} from 'react';
import {ImagePlus} from 'lucide-react';
import type {AppState,FocusSpace} from '../../../packages/core/src/model';
import {spaceTones} from '../../../packages/core/src/focus-spaces';
type Asset=AppState['focusBackgrounds'][number];
export async function importFocusImage(file:File):Promise<Asset>{
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('请选择 JPG、PNG 或 WebP 图片');
 if(file.size>10*1024*1024)throw new Error('原图请控制在 10 MB 以内');
 const url=URL.createObjectURL(file);
 try{const img=new Image();img.src=url;await img.decode();if(!img.naturalWidth||!img.naturalHeight)throw new Error('图片无法读取');
 const scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('无法处理图片，请重试');ctx.fillStyle='#f2f0e9';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
 let dataUrl=canvas.toDataURL('image/jpeg',.8);for(const quality of [.65,.5,.35]){if(dataUrl.length<=600000)break;dataUrl=canvas.toDataURL('image/jpeg',quality);}
 if(dataUrl.length>600000)throw new Error('图片细节过多，请先缩小图片后重试');
 return {id:crypto.randomUUID(),name:file.name.slice(0,120),dataUrl};
 }finally{URL.revokeObjectURL(url);}
}
export function FocusBackgroundPicker({state,tone='mint',backgroundId,onChange,onImport}:{state:AppState;tone?:FocusSpace['tone'];backgroundId?:string;onChange:(tone:FocusSpace['tone'],backgroundId?:string)=>void;onImport:(asset:Asset)=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const upload=async(e:ChangeEvent<HTMLInputElement>)=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;setBusy(true);setError('');try{if(state.focusBackgrounds.length>=10)throw new Error('最多保存 10 张背景图片，请使用已有图片');const asset=await importFocusImage(file);onImport(asset);onChange(tone,asset.id);}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 return <section className="focus-background-picker"><h3>专注背景</h3><div className="space-tone-picker" role="group" aria-label="背景配色">{Object.entries(spaceTones).map(([key,info])=><button type="button" key={key} style={{background:info.color}} aria-pressed={!backgroundId&&tone===key} onClick={()=>onChange(key as FocusSpace['tone'])}>{info.name}</button>)}</div><div className="background-library">{state.focusBackgrounds.map(asset=><button type="button" className="background-thumb" aria-label={`使用背景${asset.name}`} aria-pressed={backgroundId===asset.id} key={asset.id} onClick={()=>onChange(tone,asset.id)}><img src={asset.dataUrl} alt=""/><span>{asset.name}</span></button>)}<label className="background-upload"><ImagePlus size={20}/><span>{busy?'正在处理…':'选择本机图片'}</span><input type="file" aria-label="选择专注背景图片" accept="image/jpeg,image/png,image/webp" disabled={busy||state.focusBackgrounds.length>=10} onChange={e=>void upload(e)}/></label></div><p>图片只保存在本机支持 JPG / PNG / WebP，最多 10 MB；会自动缩小以节省空间</p>{error&&<p className="error-text" role="alert">{error}</p>}</section>;
}
export function FocusPhoto({state,backgroundId}:{state:AppState;backgroundId?:string}){const image=state.focusBackgrounds.find(b=>b.id===backgroundId);return image?<div className="focus-photo" aria-hidden="true"><img src={image.dataUrl} alt=""/><div/></div>:null;}
