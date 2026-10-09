// Render every size directly from the approved SVG; never upscale a bitmap.
import {mkdir,copyFile,mkdtemp,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve,join} from 'node:path';
const brand=resolve('apps/desktop/public/brand');
await mkdir('work',{recursive:true});
const temp=await mkdtemp(resolve('work/brand-icons-'));
function run(command,args){const result=spawnSync(command,args,{stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)throw new Error(`${command} failed: ${result.status}`);}
try{
 const sizes=[16,32,48,64,128,256,512,1024];
 run(process.execPath,[resolve('node_modules/@tauri-apps/cli/tauri.js'),'icon',join(brand,'liubai-icon.svg'),'--output',temp,...sizes.flatMap(size=>['--png',String(size)])]);
 for(const size of sizes)await copyFile(join(temp,`${size}x${size}.png`),join(brand,`${size}x${size}.png`));
 // The CLI also emits other platform formats into scratch space. Only ICNS is kept;
 // Windows must use the separately approved ICO when it is supplied.
 const native=join(temp,'native');
 run(process.execPath,[resolve('node_modules/@tauri-apps/cli/tauri.js'),'icon',join(brand,'liubai-icon.svg'),'--output',native]);
 await copyFile(join(native,'icon.icns'),join(brand,'Liubai.icns'));
}finally{await rm(temp,{recursive:true,force:true});}
console.log('品牌图标已从原始 SVG 导出。');
