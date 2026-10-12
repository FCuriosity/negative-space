// Run against locally served `pnpm android:assets` output; no phone data is used.
const {chromium}=require(process.env.LIUBAI_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.LIUBAI_CHROME?{executablePath:process.env.LIUBAI_CHROME}:{})});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  const runtime=fs.readFileSync('apps/android/app/src/main/assets/runtime.js','utf8');
  await page.addInitScript({content:runtime+`;window.engine=AndroidEngine;AndroidEngine.initialize(null);AndroidEngine.call('first_rule',{targetId:'wechat',minutes:30},Date.now(),0);window.Android={request(id,method,raw){try{const result=method==='permissions'?{usage:true,overlay:true,notifications:true,running:false}:AndroidEngine.call(method,JSON.parse(raw),Date.now(),performance.now());setTimeout(()=>window.nativeReply(id,result),0)}catch(e){window.nativeReply(id,{error:String(e)})}}};`});
  await page.goto(process.env.LIUBAI_PREVIEW_URL||'http://127.0.0.1:1422');
  await page.getByRole('navigation').getByRole('button',{name:'回顾',exact:true}).click();
  await page.getByRole('button',{name:'镜湖',exact:true}).click();
  await page.locator('.mirror-explanation summary').click();
  const slider=page.getByLabel('预览湖面亮度');
  for(const gender of ['male','female']){
   await page.evaluate(gender=>engine.call('patch',{patch:{settings:{mirrorLakeCharacterGender:gender}}},Date.now(),performance.now()),gender);
   await page.locator(`.mirror-character[data-gender="${gender}"]`).first().waitFor();
   await slider.fill('100');await page.waitForTimeout(650);
   const brightHeight=await page.locator('.mirror-world').evaluate(e=>e.getBoundingClientRect().height);
   await page.evaluate(()=>{window.originalScene=document.querySelector('.mirror-scene');window.opacitySamples=[];window.recordUntil=performance.now()+650;function sample(){window.opacitySamples.push(Number(getComputedStyle(document.querySelector('.mirror-sky-layers image')).opacity));if(performance.now()<window.recordUntil)requestAnimationFrame(sample)}requestAnimationFrame(sample)});
   await page.getByRole('button',{name:'回到真实湖面',exact:true}).click();await page.waitForTimeout(700);
   const reset=await page.evaluate(()=>({samples:window.opacitySamples,same:window.originalScene===document.querySelector('.mirror-scene'),value:document.querySelector('#mirror-preview-light').value,height:document.querySelector('.mirror-world').getBoundingClientRect().height,nodes:document.querySelectorAll('.mirror-scene *').length}));
   assert(reset.same,'Reset must preserve the scene');assert.equal(reset.value,'0');assert(Math.abs(reset.height-brightHeight)<1,'Title must not move the lake');assert(reset.nodes<350,'Animated scene must stay bounded');
   assert(reset.samples.some(x=>x>0.02&&x<.5),'Reset must fade, not jump');assert.equal(reset.samples.at(-1),0);
   for(let i=1;i<reset.samples.length;i++)assert(reset.samples[i]<=reset.samples[i-1]+.001,'Reset must not flash brighter');
   await slider.fill('100');await page.waitForTimeout(100);await slider.fill('25');await page.waitForTimeout(100);await slider.fill('80');
   await page.locator('.mirror-explanation summary').click();await page.waitForTimeout(500);
   assert.equal(await slider.inputValue(),'0','Collapsing demo must restore real light');
   await page.locator('.mirror-explanation summary').click();
  }
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  const frames=await page.evaluate(async()=>{const input=document.querySelector('#mirror-preview-light'),set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set,times=[];let last=performance.now();for(let i=0;i<90;i++){await new Promise(requestAnimationFrame);const now=performance.now();times.push(now-last);last=now;set.call(input,String((i%6)*20));input.dispatchEvent(new Event('input',{bubbles:true}));}return times.sort((a,b)=>a-b)});
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'回到真实湖面',exact:true}).click();await page.waitForTimeout(100);
  assert.equal(await page.locator('.mirror-sky-layers image').first().evaluate(e=>getComputedStyle(e).opacity),'0');
  const state=await page.evaluate(()=>engine.call('load',{},Date.now(),performance.now()).state);assert.equal(state.sessions.length,0);assert.equal(state.opens.length,0);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:['male/female continuous reset','stable scene and layout','reversed slider and collapse','reduced motion','unchanged real records'],cpuThrottle:4,frameMedianMs:frames[45],frameP95Ms:frames[85]}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
