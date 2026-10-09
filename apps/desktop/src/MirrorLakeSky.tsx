import { memo } from 'react';

// Seeded once: brightness changes reveal the same sky, without particle jumps.
function randomSequence(seed:number) {
  return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
}
const random=randomSequence(41729);
const centre=(x:number)=>12+x*.22+13*Math.sin(x/177);
const stars=Array.from({length:2700},(_,i)=>{
  const inBand=i>=820,x=5+random()*950;
  const spread=(random()+random()+random()-1.5)*(32+18*Math.sin(x/120)**2);
  const y=inBand?centre(x)+spread:4+random()*270;
  const tint=random(),rift=Math.abs(spread-5*Math.sin(x/43));
  return {x,y,radius:inBand?.2+random()*.48:.25+random()*.65,
    colour:tint>.93?'#ffcfb0':tint>.72?'#b5ccff':'#e4eafa',
    threshold:random()*.62,strength:.25+random()*.75,
    density:inBand&&rift<3?.12:1,base:!inBand&&i<28,beacon:!inBand&&i%59===0};
});
const nebula=Array.from({length:110},(_,i)=>{
  const x=-30+random()*1020;
  return {x,y:centre(x)+(random()-.5)*35,rx:12+random()*46,ry:5+random()*23,
    opacity:.2+random()*.6,tone:i%5===0?'amber':i%3===0?'rose':'blue'};
});
const dust=Array.from({length:60},()=>{
  const x=random()*960;
  return {x,y:centre(x)+5*Math.sin(x/43),rx:5+random()*18,ry:1.3+random()*4.5};
});

/** Stars, nebulae and dust share one definition for the sky and lake reflection. */
export const MirrorLakeSky=memo(function MirrorLakeSky({id,radiance}:{id:string;radiance:number}) {
  const light=Math.max(0,Math.min(1,radiance));
  return <g id={id}>
    <defs>
      {['blue','rose','amber'].map((tone,i)=><radialGradient id={`${id}-${tone}`} key={tone}>
        <stop stopColor={['#c2c8ff','#e6abbc','#f6d5b1'][i]} stopOpacity=".95"/>
        <stop offset=".4" stopColor={['#809bcf','#a97fbc','#cd9faa'][i]} stopOpacity=".45"/>
        <stop offset="1" stopColor="#5a6597" stopOpacity="0"/>
      </radialGradient>)}
      <radialGradient id={`${id}-star`}><stop stopColor="#e6edff" stopOpacity=".7"/><stop offset=".18" stopColor="#b6caff" stopOpacity=".24"/><stop offset="1" stopColor="#a2bfff" stopOpacity="0"/></radialGradient>
      <filter id={`${id}-texture`} x="-15%" y="-30%" width="130%" height="160%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency=".045 .075" numOctaves="3" seed="23" result="noise"/>
        <feColorMatrix in="noise" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  2 2 2 0 -2" result="grain"/>
        <feComposite in="SourceGraphic" in2="grain" operator="in" result="cloud"/>
        <feDisplacementMap in="cloud" in2="noise" scale="24" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
      <filter id={`${id}-dust-soft`}><feGaussianBlur stdDeviation="1.5"/></filter>
      <clipPath id={`${id}-bounds`}><rect width="960" height="280"/></clipPath>
    </defs>
    <g clipPath={`url(#${id}-bounds)`}>
      <g opacity={Math.pow(light,1.2)*.9} className="mirror-light-transition">
        <g opacity=".14">{nebula.filter((_,i)=>i%3===0).map((cloud,i)=><ellipse key={i} cx={cloud.x} cy={cloud.y} rx={cloud.rx*1.6} ry={cloud.ry*1.6} fill={`url(#${id}-${cloud.tone})`}/>)}</g>
        <g filter={`url(#${id}-texture)`}>{nebula.map((cloud,i)=><ellipse key={i} cx={cloud.x} cy={cloud.y} rx={cloud.rx} ry={cloud.ry} fill={`url(#${id}-${cloud.tone})`} opacity={cloud.opacity}/>)}</g>
        <g fill="#111c36" opacity=".58" filter={`url(#${id}-dust-soft)`}>{dust.map((d,i)=><ellipse key={i} cx={d.x} cy={d.y} rx={d.rx} ry={d.ry} transform={`rotate(12 ${d.x} ${d.y})`}/>)}</g>
      </g>
      {stars.map((star,i)=>{
        const reveal=Math.max(0,Math.min(1,(light-star.threshold)/.3));
        const opacity=star.base?.1+light*.65:reveal*star.strength*star.density;
        return star.beacon?<g key={i} opacity={opacity} className="mirror-light-transition">
          <circle cx={star.x} cy={star.y} r="7" fill={`url(#${id}-star)`}/>
          <circle cx={star.x} cy={star.y} r="1" fill={star.colour}/>
          <path d={`M${star.x-2.5} ${star.y}h5M${star.x} ${star.y-2.5}v5`} stroke={star.colour} strokeWidth=".35"/>
        </g>:<circle key={i} cx={star.x} cy={star.y} r={star.radius} fill={star.colour} opacity={opacity} className="mirror-light-transition"/>;
      })}
    </g>
  </g>;
});
