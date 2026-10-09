import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
const out = new URL('../dist/extension/',import.meta.url);
await mkdir(out,{ recursive:true });
for (const file of ['manifest.json','popup.html','popup.css','extension-id.txt']) await copyFile(new URL(`../apps/extension/${file}`,import.meta.url),new URL(file,out));
await mkdir(new URL('icons/',out),{recursive:true});
for(const size of [16,32,48,128])await copyFile(new URL(`../apps/desktop/public/brand/${size}x${size}.png`,import.meta.url),new URL(`icons/${size}x${size}.png`,out));
await build({ entryPoints:['apps/extension/src/content.ts','apps/extension/src/popup.ts','apps/extension/src/background.ts'], outdir:'dist/extension', bundle:true, format:'iife', target:'chrome120', minify:true });
console.log('浏览器扩展已构建到 dist/extension');
