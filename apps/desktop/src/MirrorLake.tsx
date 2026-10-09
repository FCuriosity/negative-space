import { useId, useState } from 'react';
import { ArrowRight, CircleHelp, Sparkles, Waves } from 'lucide-react';
import type { AppState } from '../../../packages/core/src';
import { mirrorLake } from '../../../packages/core/src/mirror-lake';
import './mirror-lake.css';
import { MirrorLakeCharacter, MirrorLakeCharacterReflection } from './MirrorLakeCharacter';
import { MirrorLakeSky } from './MirrorLakeSky';
import { MirrorLakeMountains } from './MirrorLakeMountains';

function LakeScene({light,stars,holes,gender}:{light:number;stars:number;holes:number;gender:'male'|'female'}) {
  const id=useId().replace(/:/g,'');
  const ref=(name:string)=>`url(#${id}-${name})`;
  const radiance=light*(.7+.3*Math.min(stars/25,1));
  return <svg className="mirror-scene" viewBox="0 0 960 560" role="img" aria-label={`暮色中的镜湖左侧 ${stars} 颗专注星星，右侧 ${holes} 个黑洞湖面亮度 ${Math.round(light*100)}%；${light>=.6?'星空与湖中星影逐渐璀璨，湖光映亮湖边人的面容':'星光稀疏，湖边的人仍是安静的背光剪影'}`}>
    <defs>
      <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#101a30"/><stop offset=".35" stopColor="#1c2846"/><stop offset=".68" stopColor="#51435e"/><stop offset=".9" stopColor="#bd7b80"/><stop offset="1" stopColor="#f3ba93"/></linearGradient>
      <radialGradient id={`${id}-sunset`}><stop stopColor="#ffd5a0" stopOpacity=".66"/><stop offset=".4" stopColor="#dc967c" stopOpacity=".3"/><stop offset="1" stopColor="#cb8495" stopOpacity="0"/></radialGradient>
      <linearGradient id={`${id}-water`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#846b81"/><stop offset=".2" stopColor="#535771"/><stop offset=".62" stopColor="#242e4a"/><stop offset="1" stopColor="#111d33"/></linearGradient>
      <radialGradient id={`${id}-glow`}><stop stopColor="#fff3c2" stopOpacity=".75"/><stop offset=".3" stopColor="#e4d6a8" stopOpacity=".3"/><stop offset="1" stopColor="#cad8d9" stopOpacity="0"/></radialGradient>
      <linearGradient id={`${id}-reflection-fade`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="white" stopOpacity=".9"/><stop offset=".7" stopColor="white" stopOpacity=".46"/><stop offset="1" stopColor="white" stopOpacity="0"/></linearGradient>
      <mask id={`${id}-reflection`}><rect x="0" y="332" width="960" height="228" fill={ref('reflection-fade')}/></mask>
      <clipPath id={`${id}-lake-clip`}><path d="M0 333Q252 318 480 332Q720 319 960 333V560H0Z"/></clipPath>
      <MirrorLakeSky id={`${id}-sky-stars`} radiance={radiance}/>
      <MirrorLakeCharacter id={`${id}-character`} illumination={light} gender={gender}/>
    </defs>
    <rect width="960" height="345" fill={ref('sky')}/>
    <ellipse cx="655" cy="265" rx="330" ry="130" fill={ref('sunset')}/>
    <use href={`#${id}-sky-stars`}/>
    <path d="M783 41a16 16 0 1 0 20 23 17 17 0 0 1-20-23" fill="#e4d6bb" opacity={.4+light*.25}/>
    <MirrorLakeMountains/>
    <path d="M0 333Q252 318 480 332Q720 319 960 333V560H0Z" fill={ref('water')}/>
    <g clipPath={ref('lake-clip')}>
      <ellipse cx="655" cy="335" rx="165" ry="118" fill={ref('sunset')} opacity=".25"/>
      <ellipse cx="482" cy="409" rx="233" ry="111" fill={ref('glow')} opacity={light*.75} className="mirror-light-transition"/>
      <g mask={ref('reflection')} opacity={.35+radiance*.5}><use href={`#${id}-sky-stars`} transform="translate(0 544.5) scale(1 -.65)"/></g>
      <g opacity={radiance*.45} fill="none" stroke="#e9d9ad" strokeWidth=".6" className="mirror-light-transition">{Array.from({length:17},(_,i)=><path key={i} d={`M${75+(i*73)%810} ${360+(i*17)%172}h${4+(i%4)*3}`}/>)}</g>
      <MirrorLakeCharacterReflection characterId={`${id}-character`} illumination={light} x={480} waterline={329}/>
      <path d="M269 381q204-13 417 0M304 417q178-14 357 0M359 460q117-10 251 0M398 502q82-6 160 0" fill="none" stroke="#eadcbd" strokeWidth=".8" opacity={.09+light*.24} className="mirror-ripples"/>
      {Array.from({length:8},(_,i)=><path key={i} d={`M${453-i*3} ${342+i*15}h${63+i*6}`} stroke="#48536b" strokeWidth={i%2+1} opacity=".35"/>)}
    </g>
    <path d="M379 331q34-9 66-7l19-4q19-4 40 3 28-3 68 10-97 8-193-2Z" fill="#19263a"/>
    <path d="M427 328q37-6 70-1m18 2 33 2" fill="none" stroke="#a8a391" strokeWidth=".7" opacity=".32"/>
    <ellipse cx="482" cy="306" rx="75" ry="60" fill={ref('glow')} opacity={light*.16}/>
    <use href={`#${id}-character`} transform="translate(480 329)"/>
    {holes>0&&<ellipse cx="805" cy="435" rx="123" ry="57" fill="#090f25" opacity={Math.min(.45,holes*.06)}/>}
    <g transform="translate(70 255)"><Jar id={id+'-stars'} kind="star" count={stars}/></g>
    <g transform="translate(748 255)"><Jar id={id+'-holes'} kind="hole" count={holes}/></g>
    {stars>0&&<path d="M216 408Q335 367 458 398" fill="none" stroke="#ebd695" strokeWidth=".8" strokeDasharray="1 11" opacity={.12+light*.4} className="mirror-current"/>}
    <g fill="#c4cbd3" textAnchor="middle" fontSize="12" letterSpacing="2"><text x="142" y="517">收集每一次投入</text><text x="820" y="517">看见无意识的惯性</text></g>
    <text x="480" y="541" textAnchor="middle" fill="#c6cbd9" fontSize="11" letterSpacing="3">把光留住，也把自己看清</text>
  </svg>;
}
function Jar({id,kind,count}:{id:string;kind:'star'|'hole';count:number}) {
  const star=kind==='star';
  return <g>
    <defs><linearGradient id={id}><stop stopColor="#d5e5db" stopOpacity=".16"/><stop offset=".5" stopColor="#cbded5" stopOpacity=".02"/><stop offset="1" stopColor="#d5e5db" stopOpacity=".14"/></linearGradient><radialGradient id={`${id}-halo`}><stop stopColor={star?'#f1d797':'#9383bb'} stopOpacity=".3"/><stop offset="1" stopColor={star?'#f1d797':'#9383bb'} stopOpacity="0"/></radialGradient></defs>
    <ellipse cx="72" cy="205" rx="90" ry="23" fill={`url(#${id}-halo)`}/>
    {count>0&&<ellipse cx="72" cy="155" rx="96" ry="93" fill={`url(#${id}-halo)`}/>}
    <path d="M28 18V37Q9 47 9 67V177Q9 199 31 201H113Q135 199 135 177V67Q135 47 116 37V18Z" fill={`url(#${id})`} stroke="#bdd8ce" strokeOpacity=".45"/>
    <ellipse cx="72" cy="18" rx="45" ry="8" fill="#243b43" stroke="#bcd5cb" strokeOpacity=".6"/>
    <ellipse cx="72" cy="18" rx="36" ry="4" fill="#0d202c"/>
    <path d="M22 71V157M28 58 37 48M122 160V179Q122 188 114 190" stroke="#e3efe3" strokeWidth="2" opacity=".3" fill="none"/>
    {Array.from({length:Math.min(18,count)},(_,i)=>{const x=32+(i%4)*27+(Math.floor(i/4)%2)*4,y=179-Math.floor(i/4)*27;return <g key={i} transform={`translate(${x} ${y})`} className={star?'mirror-star':''} style={{animationDelay:`${i*.27}s`}}>{star?<><circle r="18" fill={`url(#${id}-halo)`}/><path d="m0-9 2.6 6.4L9 0 2.6 2.6 0 9-2.6 2.6-9 0-2.6-2.6Z" fill="#ffe6a6"/><circle r="2" fill="#fff6d7"/></>:<><ellipse rx="12" ry="6" transform="rotate(-28)" fill="none" stroke="#9785b4" strokeWidth="1.2"/><circle r="7" fill="#080e1a" stroke="#66577f" strokeWidth="1.2"/><path d="M-12 2Q0 9 12-3" fill="none" stroke="#b59dd0" opacity=".7"/></>}</g>;})}
    <text x="72" y="-13" textAnchor="middle" fill={star?'#e6d4a1':'#b5adca'} fontSize="13" letterSpacing="4">{star?'星光罐':'黑洞罐'}</text>
    <text x="72" y="233" textAnchor="middle" fill={star?'#f0dfb0':'#bdb2d1'} fontSize="24" fontFamily="Georgia,serif">{count}<tspan fontSize="13"> {star?'颗':'个'}</tspan></text>
  </g>;
}
export function MirrorLake({state,now,onClassify,onFocus,onReason}:{state:AppState;now:number;onClassify:(id:string,intention:string)=>Promise<void>;onFocus:()=>void;onReason:(id:string)=>void}) {
  const [range,setRange]=useState('all');const [filter,setFilter]=useState('pending');const [limit,setLimit]=useState(10);
  const [busy,setBusy]=useState('');const [error,setError]=useState('');const [preview,setPreview]=useState<number|null>(null);
  const lake=mirrorLake(state,now,range==='today');const light=preview??lake.light;
  const entries=lake.entries.filter(o=>filter==='all'||!o.intention||o.intention==='pending');
  const title=light>=.8?'明镜鉴己身':light>=.4?'微光正在勾勒你的轮廓':'此刻，湖边只有安静的剪影';
  const classify=async(id:string,value:string)=>{setBusy(id);setError('');try{await onClassify(id,value);}catch(e){setError(String(e));}finally{setBusy('');}};
  return <div className="mirror-lake">
    <div className="mirror-toolbar"><span><Waves size={16}/> 一面湖，照见注意力的去向</span><select aria-label="镜湖记录范围" value={range} onChange={e=>{setRange(e.target.value);setPreview(null);setLimit(10);}}><option value="all">近 {state.settings.retentionDays} 天</option><option value="today">今天</option></select></div>
    <section className="mirror-world" aria-label="星光与黑洞的镜湖">
      <div className="mirror-heading"><span className="mirror-eyebrow">MIRROR LAKE · 镜湖</span><h2>{title}</h2></div>
      <LakeScene light={light} stars={lake.stars.length} holes={lake.holes.length} gender={state.settings.mirrorLakeCharacterGender??'male'}/>
      </section>
    <div className="mirror-light-meter"><span>真实湖面亮度</span><div role="meter" aria-label="真实湖面亮度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(lake.light*100)}><i style={{width:`${lake.light*100}%`}}/></div><strong>{Math.round(lake.light*100)}%</strong></div>
    <div className="mirror-summary"><div><Sparkles size={19}/><span>已完成专注<strong>{lake.stars.length} <small>颗星光</small></strong></span></div><div><span className="mirror-hole-icon"/><span>确认无意识打开<strong>{lake.holes.length} <small>个黑洞</small></strong></span></div><button onClick={()=>{setFilter('pending');document.getElementById('mirror-records')?.scrollIntoView({behavior:'smooth'});}}><CircleHelp size={19}/><span>打开意图待确认<strong>{lake.pending.length} <small>条记录</small></strong></span></button></div>
    <div className="mirror-invitation"><div><h3>{lake.stars.length?'下一段投入，会带来新的光':'从第一颗星开始，慢慢看清自己'}</h3><p>提前结束不会产生星星待确认和有意打开，都不会形成黑洞</p></div><button className="button primary" onClick={onFocus}>去专注 <ArrowRight size={16}/></button></div>
    <details className="mirror-explanation" onToggle={e=>{if(!e.currentTarget.open)setPreview(null);}}><summary>光是怎样照亮镜湖的？</summary><p>每完成一次专注，星光罐增加 1 颗星；每确认一次“超额或时段外，且无意识”的打开，黑洞罐增加 1 个黑洞每颗星提供 20% 亮度，每个黑洞消耗 20%，亮度保持在 0–100%星星仍留在罐中；净星光达到 5 颗，湖面亮起，脸庞与倒影清晰可见星光增加时，夜空中的星点也会变得更丰富、明亮，并倒映在湖中；黑洞会削弱这份光亮</p><p>镜湖展示所选范围内的记录，随设置中的 {state.settings.retentionDays} 天保留期清理只从本次升级起记录打开当时的超额与时段外状态，旧打开记录不推断、不补记黑洞临时放行仍保留打开时的状态；星光不改变每日配额或专注奖励</p><section className="mirror-demo" aria-label="光影演示"><div className="mirror-demo-heading"><h3>光影演示</h3><span>{preview===null?'当前为真实湖面':'正在预览'}</span></div><p>拖动滑块，看看星空、湖面与面容如何随光亮变化演示不会增减真实星星和黑洞；收起此板块会自动回到真实湖面</p><div className="mirror-preview"><label htmlFor="mirror-preview-light">演示亮度</label><input id="mirror-preview-light" aria-label="预览湖面亮度" type="range" min="0" max="100" step="20" value={Math.round(light*100)} onChange={e=>setPreview(Number(e.target.value)/100)}/><output htmlFor="mirror-preview-light">{Math.round(light*100)}%</output><button className="text-button" onClick={()=>setPreview(null)}>回到真实湖面</button></div></section></details>
    <section className="mirror-records" id="mirror-records"><div className="section-heading"><div><h2>看见每一次无意识</h2><p>打开时已用完每日额度，或不在允许时段内，会出现在这里由你确认当时的意图</p></div><select aria-label="镜湖打开记录筛选" value={filter} onChange={e=>{setFilter(e.target.value);setLimit(10);}}><option value="pending">待确认 ({lake.pending.length})</option><option value="all">全部待回顾记录 ({lake.entries.length})</option></select></div>
      {error&&<p className="error-text" role="alert">{error}</p>}
      {!entries.length?<div className="mirror-empty"><Waves size={26}/><p>{filter==='pending'?'湖面平静，没有待确认的打开':'这段时间，还没有记录到超额或时段外打开'}</p><span>在 Mac 应用中开启管理后，切回受管理 App 时自动记录</span></div>:entries.slice(0,limit).map(o=>{const reason=state.openReasons.find(r=>r.eventId===o.id && r.source==='open');return <article className="mirror-record" key={o.id}><div><div className="mirror-record-heading"><h3>{state.targets.find(t=>t.id===o.targetId)?.name??'应用'}</h3><span className={`mirror-badge ${o.intention??'pending'}`}>{o.intention==='accidental'?'已放入黑洞罐':o.intention==='intentional'?'有意打开':'待确认 · 不计黑洞'}</span></div><p>{new Intl.DateTimeFormat('zh-CN',{timeZone:state.settings.timezone,month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(o.at)} · {[...(o.outsideAllowedWindow?['允许时段外']:[]),...(o.quotaExceeded??[]).map(r=>r==='daily-time'?'时长用完':'次数用完')].join(' / ')}</p><p className="mirror-reason">{reason?.text||'还没有留下打开理由'} <button className="text-button" onClick={()=>onReason(o.id)}>{reason?'编辑理由':'补写理由'}</button></p></div><div className="mirror-classify" aria-label="确认打开意图"><button disabled={!!busy} aria-pressed={o.intention==='intentional'} onClick={()=>void classify(o.id,'intentional')}>有意打开</button><button disabled={!!busy} aria-pressed={o.intention==='accidental'} onClick={()=>void classify(o.id,'accidental')}>无意点开</button>{o.intention&&o.intention!=='pending'&&<button disabled={!!busy} onClick={()=>void classify(o.id,'pending')}>撤回判断</button>}</div></article>;})}
      {entries.length>limit&&<button className="button secondary" onClick={()=>setLimit(n=>n+10)}>查看更多记录</button>}
      <p className="mirror-record-note">判断可以随时修改这里的明暗，是注意力的记录，也给下一次选择留着空间</p>
    </section>
  </div>;
}
