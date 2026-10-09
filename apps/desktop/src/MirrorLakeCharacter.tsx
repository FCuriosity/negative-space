import { useId } from 'react';
import dark from './assets/mirror-lake/mirror-character-dark.png';
import mid from './assets/mirror-lake/mirror-character-mid.png';
import bright from './assets/mirror-lake/mirror-character-bright.png';
import femaleDark from './assets/mirror-lake/female/mirror-character-dark.png';
import femaleMid from './assets/mirror-lake/female/mirror-character-mid.png';
import femaleBright from './assets/mirror-lake/female/mirror-character-bright.png';
import femaleMask from './assets/mirror-lake/female/mirror-character-mask.png';
import './mirror-lake-character.css';

const clamp01=(value:number)=>Number.isNaN(value)?0:Math.max(0,Math.min(1,value));
const smoothstep=(start:number,end:number,value:number)=>{
  const t=clamp01((value-start)/(end-start));
  return t*t*(3-2*t);
};

/** Visual interpolation only. Scoring belongs to the existing mirrorLake state. */
export function characterLighting(illumination:number) {
  const light=clamp01(illumination);
  return {
    light,
    mid:smoothstep(.08,.55,light),
    bright:smoothstep(.55,.98,light),
    reflectionOpacity:.07+.35*light,
    reflectionBlur:2.1-1.75*light,
  };
}

export const CHARACTER_GEOMETRY={height:192,width:128,anchorX:.4668,anchorY:.9310,reflectionScale:.76} as const;

/** SVG source with its origin at the supplied canvas foot anchor, not its centre.
 * Place in scene <defs>; standing and reflected <use> share these exact layers.
 */
export function MirrorLakeCharacter({id,illumination,gender='male',reducedMotion=false}:{id:string;illumination:number;gender?:'male'|'female';reducedMotion?:boolean}) {
  const lighting=characterLighting(illumination);
  const {height,width,anchorX,anchorY}=CHARACTER_GEOMETRY;
  const female=gender==='female';
  const images=female?[femaleDark,femaleMid,femaleBright]:[dark,mid,bright];
  // Female delivery feet end at y≈1480, vs the declared waterline at 1430.
  // Calibrate the entire set once; all states and their reflection stay registered.
  return <g id={id} className="mirror-character" data-gender={gender} data-reduced-motion={reducedMotion||undefined}>
    {female&&<defs>
      <filter id={`${id}-matte`}><feComponentTransfer><feFuncA type="linear" slope="8" intercept="-.12"/></feComponentTransfer></filter>
      <mask id={`${id}-silhouette`} maskUnits="userSpaceOnUse" x={-width*anchorX} y={-height*anchorY} width={width} height={height}>
        <image href={femaleMask} x={-width*anchorX} y={-height*anchorY} width={width} height={height} filter={`url(#${id}-matte)`}/>
      </mask>
    </defs>}
    <g transform={female?'translate(0 -6.25)':undefined} mask={female?`url(#${id}-silhouette)`:undefined}>
    {[{name:'dark',href:images[0],opacity:1},{name:'mid',href:images[1],opacity:lighting.mid},{name:'bright',href:images[2],opacity:lighting.bright}].map(layer=><image
      key={layer.name} href={layer.href} x={-width*anchorX} y={-height*anchorY}
      width={width} height={height} preserveAspectRatio="xMidYMid meet"
      className="mirror-character-layer" data-state={layer.name} opacity={layer.opacity}
    />)}
    </g>
  </g>;
}

export function MirrorLakeCharacterReflection({characterId,illumination,x,waterline,reducedMotion=false}:{characterId:string;illumination:number;x:number;waterline:number;reducedMotion?:boolean}) {
  const id=useId().replace(/:/g,'');
  const {reflectionOpacity,reflectionBlur}=characterLighting(illumination);
  const height=CHARACTER_GEOMETRY.height*CHARACTER_GEOMETRY.reflectionScale;
  return <g className="mirror-character-reflection" data-reduced-motion={reducedMotion||undefined} aria-hidden="true">
    <defs>
      {/* Retain enough of the far end to make the reflected face legible in light. */}
      <linearGradient id={`${id}-fade`} gradientUnits="userSpaceOnUse" x1={0} x2={0} y1={waterline} y2={waterline+height}>
        <stop stopColor="white"/><stop offset=".8" stopColor="white" stopOpacity=".82"/><stop offset="1" stopColor="white" stopOpacity="0"/>
      </linearGradient>
      <mask id={`${id}-mask`} maskUnits="userSpaceOnUse" x={x-100} y={waterline} width={210} height={height}>
        <rect x={x-100} y={waterline} width={210} height={height} fill={`url(#${id}-fade)`}/>
      </mask>
    </defs>
    <g mask={`url(#${id}-mask)`}>
      <g className="mirror-character-water-image" style={{opacity:reflectionOpacity,filter:`blur(${reflectionBlur}px)`}}>
        <use href={`#${characterId}`} transform={`translate(${x} ${waterline}) scale(1 -${CHARACTER_GEOMETRY.reflectionScale})`}/>
      </g>
    </g>
  </g>;
}
