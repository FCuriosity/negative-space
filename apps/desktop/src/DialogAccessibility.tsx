import {useEffect} from 'react';
/** Keeps keyboard navigation inside the top dialog and restores the invoking control. */
export function DialogAccessibility(){
  useEffect(()=>{
    let dialog:HTMLElement|null=null;
    let previous:HTMLElement|null=null;
    let lastBackgroundFocus:HTMLElement|null=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const rememberFocus=(event:FocusEvent)=>{
      const target=event.target;
      if(target instanceof HTMLElement&&!target.closest('[role="dialog"][aria-modal="true"]'))lastBackgroundFocus=target;
    };
    const rememberPointer=(event:Event)=>{
      const target=event.target instanceof Element?event.target.closest<HTMLElement>('button,a[href],input,select,textarea,[tabindex]'):null;
      if(target&&!target.closest('[role="dialog"][aria-modal="true"]'))lastBackgroundFocus=target;
    };
    document.addEventListener('focusin',rememberFocus,true);
    document.addEventListener('pointerdown',rememberPointer,true);
    document.addEventListener('click',rememberPointer,true);
    let release:(()=>void)|undefined;
    const sync=()=>{
      const next=Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')).at(-1)??null;
      if(next===dialog)return;
      release?.();release=undefined;
      const old=dialog;dialog=next;
      if(!next){const restore=previous;previous=null;if(old&&restore?.isConnected)requestAnimationFrame(()=>{if(!document.querySelector('[role="dialog"][aria-modal="true"]'))restore.focus({preventScroll:true});});return;}
      if(!old)previous=lastBackgroundFocus;
      const background=Array.from(document.querySelectorAll<HTMLElement>('.sidebar,main')).map(node=>({node,inert:node.inert}));
      background.forEach(({node})=>{node.inert=true;});
      const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
      const candidates=()=>Array.from(next.querySelectorAll<HTMLElement>('button,input,textarea,select,a[href],[tabindex]')).filter(n=>!n.hasAttribute('disabled')&&n.tabIndex>=0&&n.getClientRects().length>0);
      if(!next.contains(document.activeElement))candidates()[0]?.focus({preventScroll:true});
      const trap=(event:KeyboardEvent)=>{
        if(event.key!=='Tab')return;
        const controls=candidates(),first=controls[0],last=controls.at(-1);
        if(!first){event.preventDefault();return;}
        if(event.shiftKey&&(document.activeElement===first||!next.contains(document.activeElement))){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&(document.activeElement===last||!next.contains(document.activeElement))){event.preventDefault();first.focus();}
      };
      document.addEventListener('keydown',trap,true);
      release=()=>{document.removeEventListener('keydown',trap,true);background.forEach(({node,inert})=>{node.inert=inert;});document.body.style.overflow=overflow;};
    };
    const observer=new MutationObserver(sync);observer.observe(document.getElementById('root')!,{childList:true,subtree:true});sync();
    return()=>{observer.disconnect();document.removeEventListener('focusin',rememberFocus,true);document.removeEventListener('pointerdown',rememberPointer,true);document.removeEventListener('click',rememberPointer,true);release?.();};
  },[]);
  return null;
}
