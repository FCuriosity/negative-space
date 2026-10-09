import {mkdir,cp,symlink,writeFile,readFile,mkdtemp,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
if(process.platform!=='darwin')throw Error('DMG packaging requires macOS');
const version=JSON.parse(await readFile('package.json','utf8')).version;
const release=resolve('dist/release');await mkdir(release,{recursive:true});
const stage=await mkdtemp(join(tmpdir(),'liubai-dmg-'));
function run(cmd,args){const r=spawnSync(cmd,args,{stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)throw Error(`${cmd} failed: ${r.status}`);}
try{
 await cp('dist/留白.app',join(stage,'留白.app'),{recursive:true});
 await symlink('/Applications',join(stage,'Applications'));
 await writeFile(join(stage,'安装说明.txt'),'将「留白」拖入 Applications 后运行\n浏览器扩展：留白 → 连接管理 → 准备本地连接 → 打开扩展文件夹\n本测试版未做 Developer ID 签名或 Apple 公证，系统可能显示无法验证开发者\n数据保存在本机，升级前可在偏好设置导出备份\n');
 run('xattr',['-cr',join(stage,'留白.app')]);
 run('codesign',['--verify','--deep','--strict',join(stage,'留白.app')]);
 const name=`Liubai-${version}-macos-${process.arch}.dmg`;
 run('hdiutil',['create','-volname','留白','-srcfolder',stage,'-ov','-format','UDZO',join(release,name)]);
 run('hdiutil',['verify',join(release,name)]);
 console.log(join(release,name));
}finally{await rm(stage,{recursive:true,force:true});}
