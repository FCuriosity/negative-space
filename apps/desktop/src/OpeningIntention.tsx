export function OpeningIntention({value,onChange,disabled=false}:{value:string;onChange:(value:string)=>void;disabled?:boolean}) {
  return <fieldset className="opening-intention" disabled={disabled}><legend>这次打开，是有意识的选择吗？</legend><div><button type="button" aria-pressed={value==='intentional'} onClick={()=>onChange('intentional')}>有明确目的</button><button type="button" aria-pressed={value==='accidental'} onClick={()=>onChange('accidental')}>无意识打开</button></div><p>{value==='accidental'?'保存后，这次打开会成为镜湖中的一个黑洞':value==='intentional'?'记录这次目的，不增加黑洞':'由你判断；未确认前不会增加黑洞'}</p></fieldset>;
}
