import {build} from 'esbuild';
import {mkdir,cp,copyFile,readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
function run(cmd,args){const r=spawnSync(cmd,args,{stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)throw Error(`${cmd} failed: ${r.status}`);}
const out=resolve('apps/windows/build');await mkdir(out,{recursive:true});
await build({entryPoints:['apps/windows/main.mjs'],bundle:true,platform:'node',format:'esm',target:'node24',external:['electron'],outfile:`${out}/main.mjs`});
await copyFile('apps/windows/preload.cjs',`${out}/preload.cjs`);
await cp('dist/desktop',`${out}/web`,{recursive:true});
await cp('dist/extension',`${out}/resources/extension`,{recursive:true});
await cp('apps/desktop/public/brand',`${out}/resources/brand`,{recursive:true});
// ICO container of the existing approved PNG artwork, no new artwork generation.
const png=await readFile('apps/desktop/public/brand/256x256.png');const ico=Buffer.alloc(22);ico.writeUInt16LE(1,2);ico.writeUInt16LE(1,4);ico.writeUInt16LE(1,10);ico.writeUInt16LE(32,12);ico.writeUInt32LE(png.length,14);ico.writeUInt32LE(22,18);await writeFile(`${out}/resources/brand/Liubai.ico`,Buffer.concat([ico,png]));
if(!process.argv.includes('--js-only')){
 if(process.platform!=='win32')throw Error('原生 Windows 构建请在 Windows 或 GitHub Actions 上运行');
 run('dotnet',['publish','apps/windows/native/Liubai.Native.csproj','-c','Release','-r','win-x64','--self-contained','true','-o',`${out}/resources/native`]);
}
console.log('Windows app prepared');
