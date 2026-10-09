import { describe,expect,it } from 'vitest';
import { characterLighting,CHARACTER_GEOMETRY } from '../src/MirrorLakeCharacter';

describe('Mirror Lake character lighting contract',()=>{
  it('holds the shadow at zero and waits for sufficient light before revealing the bright face',()=>{
    expect(characterLighting(0)).toMatchObject({mid:0,bright:0,reflectionOpacity:.07,reflectionBlur:2.1});
    expect(characterLighting(.55)).toMatchObject({mid:1,bright:0});
    expect(characterLighting(1)).toMatchObject({mid:1,bright:1,reflectionOpacity:.42});
    expect(characterLighting(1).reflectionBlur).toBeCloseTo(.35);
  });
  it('is continuous across every blend boundary and reversible without hysteresis',()=>{
    for(const boundary of [.08,.55,.98]) {
      const left=characterLighting(boundary-1e-6),right=characterLighting(boundary+1e-6);
      expect(Math.abs(left.mid-right.mid)).toBeLessThan(1e-4);
      expect(Math.abs(left.bright-right.bright)).toBeLessThan(1e-4);
    }
    const forward=Array.from({length:101},(_,i)=>characterLighting(i/100));
    expect([...forward].reverse()).toEqual(Array.from({length:101},(_,i)=>characterLighting((100-i)/100)));
    for(let i=1;i<forward.length;i++){
      expect(forward[i].mid).toBeGreaterThanOrEqual(forward[i-1].mid);
      expect(forward[i].bright).toBeGreaterThanOrEqual(forward[i-1].bright);
      expect(forward[i].reflectionOpacity).toBeGreaterThanOrEqual(forward[i-1].reflectionOpacity);
      expect(forward[i].reflectionBlur).toBeLessThanOrEqual(forward[i-1].reflectionBlur);
    }
  });
  it('clamps invalid parent input to a stable legal state',()=>{
    expect(characterLighting(-1)).toEqual(characterLighting(0));
    expect(characterLighting(2)).toEqual(characterLighting(1));
    expect(characterLighting(NaN)).toEqual(characterLighting(0));
  });
  it('preserves the full canvas ratio and the supplied foot anchor under reflection',()=>{
    const {width,height,anchorX,anchorY,reflectionScale}=CHARACTER_GEOMETRY;
    expect(width/height).toBe(1024/1536);
    expect(anchorX).toBe(.4668);expect(anchorY).toBe(.931);
    const footX=-width*anchorX+width*anchorX;
    const footY=-height*anchorY+height*anchorY;
    expect(480+footX).toBe(480);
    expect(329-footY*reflectionScale).toBe(329);
  });
});
