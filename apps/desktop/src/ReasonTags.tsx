import { useId, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { appendReasonTag, normalizeReasonTags, RECOVERY_REASON_TAG } from '../../../packages/core/src/reason-tags';

export function ReasonTags({tags,text,onText,onSave,disabled=false}:{tags:string[];text:string;onText:(value:string)=>void;onSave:(tags:string[])=>Promise<void>;disabled?:boolean}) {
  const id=useId();
  const availableTags=[...new Set([RECOVERY_REASON_TAG,...tags])];
  const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const pick=(tag:string)=>{try{onText(appendReasonTag(text,tag));setError('');}catch(e){setError((e as Error).message);}};
  const save=async(next:string[],selected?:string)=>{
    setBusy(true);setError('');
    try {await onSave(normalizeReasonTags(next));if(selected){pick(selected);setDraft('');}}
    catch(e){setError((e as Error).message);}
    finally{setBusy(false);}
  };
  return <section className="reason-tags" aria-label="快捷理由标签">
    <div className="reason-tags-heading"><span>快捷理由</span><button type="button" className="text-button" disabled={disabled||busy} aria-expanded={editing} aria-controls={id} onClick={()=>setEditing(!editing)}>{editing?'完成管理':'自定义标签'}</button></div>
    <div className="reason-tag-list">{availableTags.map(tag=><span className="reason-tag" key={tag}><button type="button" disabled={disabled||busy} aria-label={`选择理由：${tag}`} onClick={()=>pick(tag)}>{tag}</button>{editing&&tag!==RECOVERY_REASON_TAG&&<button className="reason-tag-remove" type="button" disabled={disabled||busy} aria-label={`删除理由标签：${tag}`} onClick={()=>void save(tags.filter(item=>item!==tag))}><X size={13}/></button>}</span>)}</div>
    {editing&&<div id={id} className="reason-tag-editor"><label>新标签<input aria-label="自定义理由标签" placeholder="例如：联系家人" value={draft} maxLength={16} disabled={disabled||busy} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();if(draft.trim())void save([...tags,draft],draft.trim());}}}/></label><button type="button" className="button secondary" disabled={disabled||busy||!draft.trim()} onClick={()=>void save([...tags,draft],draft.trim())}><Plus size={15}/>{busy?'保存中…':'保存并选用'}</button><p>最多 20 个，每个 1–16 字只保存在这台电脑，删除标签不影响已有理由</p></div>}
    {error&&<p className="error-text" role="alert">{error}</p>}
  </section>;
}
