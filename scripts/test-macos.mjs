import {mkdir,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const root=resolve('work/macos-integration');
const app=`${root}/Fixture.app/Contents`;
await mkdir(`${app}/MacOS`,{recursive:true});
await mkdir(resolve('work/swift-module-cache'),{recursive:true});
await writeFile(`${app}/Info.plist`,'<?xml version="1.0"?><plist version="1.0"><dict><key>CFBundleExecutable</key><string>Fixture</string><key>CFBundleIdentifier</key><string>local.liubai.test-fixture</string><key>CFBundlePackageType</key><string>APPL</string><key>LSUIElement</key><true/></dict></plist>');
function run(cmd,args) {const r=spawnSync(cmd,args,{stdio:'inherit',timeout:120000});if(r.status!==0){console.error(r.error??`exit ${r.status}`);process.exit(r.status??1);}}
run('swiftc',['-swift-version','5','-module-cache-path',resolve('work/swift-module-cache'),'tests/macos/Fixture.swift','-o',`${app}/MacOS/Fixture`]);
run('swiftc',['-swift-version','5','-module-cache-path',resolve('work/swift-module-cache'),'tests/macos/main.swift','apps/macos/System.swift','-o',`${root}/verify`]);
run(`${root}/verify`,[`${root}/Fixture.app`]);
