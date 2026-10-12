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

// Each source is immutable: the browser caches its image instead of animating
// thousands of SVG nodes (and their <use> reflection) on every slider input.
const imageSource=(body:string)=>`data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 280">${body}</svg>`)}`;
const gradients=['blue','rose','amber'].map((tone,i)=>`<radialGradient id="${tone}"><stop stop-color="${['#c2c8ff','#e6abbc','#f6d5b1'][i]}" stop-opacity=".95"/><stop offset=".4" stop-color="${['#809bcf','#a97fbc','#cd9faa'][i]}" stop-opacity=".45"/><stop offset="1" stop-color="#5a6597" stop-opacity="0"/></radialGradient>`).join('');
const ellipse=(c:typeof nebula[number],scale=1)=>`<ellipse cx="${c.x}" cy="${c.y}" rx="${c.rx*scale}" ry="${c.ry*scale}" fill="url(#${c.tone})" opacity="${scale===1?c.opacity:1}"/>`;
const cloudSource=imageSource(`<defs>${gradients}<filter id="texture" x="-15%" y="-30%" width="130%" height="160%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".045 .075" numOctaves="3" seed="23" result="noise"/><feColorMatrix in="noise" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  2 2 2 0 -2" result="grain"/><feComposite in="SourceGraphic" in2="grain" operator="in" result="cloud"/><feDisplacementMap in="cloud" in2="noise" scale="24" xChannelSelector="R" yChannelSelector="G"/></filter><filter id="dust"><feGaussianBlur stdDeviation="1.5"/></filter></defs><g opacity=".14">${nebula.filter((_,i)=>i%3===0).map(c=>ellipse(c,1.6)).join('')}</g><g filter="url(#texture)">${nebula.map(c=>ellipse(c)).join('')}</g><g fill="#111c36" opacity=".58" filter="url(#dust)">${dust.map(d=>`<ellipse cx="${d.x}" cy="${d.y}" rx="${d.rx}" ry="${d.ry}" transform="rotate(12 ${d.x} ${d.y})"/>`).join('')}</g>`);
const starGradient='<defs><radialGradient id="star"><stop stop-color="#e6edff" stop-opacity=".7"/><stop offset=".18" stop-color="#b6caff" stop-opacity=".24"/><stop offset="1" stop-color="#a2bfff" stop-opacity="0"/></radialGradient></defs>';
const drawStar=(s:typeof stars[number])=>s.beacon?`<g opacity="${s.base?1:s.strength*s.density}"><circle cx="${s.x}" cy="${s.y}" r="7" fill="url(#star)"/><circle cx="${s.x}" cy="${s.y}" r="1" fill="${s.colour}"/><path d="M${s.x-2.5} ${s.y}h5M${s.x} ${s.y-2.5}v5" stroke="${s.colour}" stroke-width=".35"/></g>`:`<circle cx="${s.x}" cy="${s.y}" r="${s.radius}" fill="${s.colour}" opacity="${s.base?1:s.strength*s.density}"/>`;
const baseSource=imageSource(starGradient+stars.filter(s=>s.base).map(drawStar).join(''));
// Twelve reveal bands retain all 2700 star positions and colours with a bounded
// number of opacity updates, including when reversing direction mid-transition.
const bandCount=12;
const bands=Array.from({length:bandCount},(_,i)=>({threshold:(i+.5)*.62/bandCount,src:imageSource(starGradient+stars.filter(s=>!s.base&&Math.min(bandCount-1,Math.floor(s.threshold/.62*bandCount))===i).map(drawStar).join(''))}));

export const MirrorLakeSky=memo(function MirrorLakeSky({radiance}:{radiance:number}) {
  const light=Math.max(0,Math.min(1,radiance));
  return <g className="mirror-sky-layers">
    <image href={cloudSource} width="960" height="280" opacity={Math.pow(light,1.2)*.9} className="mirror-light-transition"/>
    <image href={baseSource} width="960" height="280" opacity={.1+light*.65} className="mirror-light-transition"/>
    {bands.map((band,i)=><image key={i} href={band.src} width="960" height="280" opacity={Math.max(0,Math.min(1,(light-band.threshold)/.3))} className="mirror-light-transition"/>)}
  </g>;
});
