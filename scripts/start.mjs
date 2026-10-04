import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, readdir, realpath } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join, dirname, delimiter } from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
process.chdir(root);
const runtime=join(root,'.runtime');
const digest=value=>createHash('sha256').update(value).digest('hex');
const address='http://127.0.0.1:8081/';
const instanceId=digest(root);
const env={...process.env,EXPO_OFFLINE:'1',EXPO_NO_TELEMETRY:'1'};
const run=(file,args)=>new Promise((resolve,reject)=>{const child=spawn(file,args,{cwd:root,env,stdio:'inherit',windowsHide:true});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error(`İşlem başarısız: ${file} (${code})`)));});
const node=args=>run(process.execPath,['--use-system-ca',...args]);
function openBrowser(){
 const command=process.platform==='win32'?'cmd.exe':process.platform==='darwin'?'open':'xdg-open';
 const args=process.platform==='win32'?['/d','/c','start','',address]:[address];
 try{const child=spawn(command,args,{cwd:root,stdio:'ignore',windowsHide:true,detached:true});child.on('error',()=>console.log('Tarayıcı otomatik açılamadı; şu adresi aç: '+address));child.unref();}
 catch{console.log('Tarayıcı otomatik açılamadı; şu adresi aç: '+address);}
}
async function waitForServer(){
 for(let attempt=0;attempt<30;attempt++){
  try{const response=await fetch(address+'api/words/status',{signal:AbortSignal.timeout(1000)});if(response.ok&&((await response.json()).instanceId===instanceId))return true;}catch{}
  await new Promise(resolve=>setTimeout(resolve,300));
 }
 return false;
}
async function fingerprint(paths){const hash=createHash('sha256');async function visit(path){for(const e of (await readdir(path,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const p=join(path,e.name);if(e.isDirectory())await visit(p);else{hash.update(p.slice(root.length));hash.update(await readFile(p));}}}for(const p of paths){if(p.endsWith('/'))await visit(join(root,p));else hash.update(await readFile(join(root,p)));}return hash.digest('hex');}
async function main(){
 if(Number(process.versions.node.split('.')[0])<24)throw Error('Node.js 24 veya üzeri gerekli: https://nodejs.org');
 // Avoid installing over a running copy of this notebook.
 try{const r=await fetch(address+'api/words/status',{signal:AbortSignal.timeout(1500)});if(r.ok){const status=await r.json();if(status.instanceId!==instanceId)throw Error('8081 portunda başka bir English Desk klasörü açık. Veri karışmaması için onu kapatıp tekrar başlat.');console.log('Uygulama zaten açık: '+address);openBrowser();return;}}catch(error){if(error.message?.includes('başka bir English Desk'))throw error;}
 await mkdir(runtime,{recursive:true});
 const lockHash=digest(await readFile('package-lock.json'));let state={};try{state=JSON.parse(await readFile(join(runtime,'startup.json'),'utf8'));}catch{}
 if(!existsSync('node_modules/expo/bin/cli')||state.dependencies!==lockHash||state.platform!==process.platform||state.arch!==process.arch){
  console.log('Proje bağımlılıkları hazırlanıyor…');
  let npm=process.env.npm_execpath||join(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
  if(!existsSync(npm)&&process.platform!=='win32'){for(const dir of (process.env.PATH||'').split(delimiter)){const candidate=join(dir,'npm');if(existsSync(candidate)){npm=await realpath(candidate);break;}}}
  if(!existsSync(npm))throw Error('npm bulunamadı. Node.js LTS kurulumunu npm ile birlikte yapın.');
  await node([npm,'ci','--no-audit','--no-fund']);state.dependencies=lockHash;state.platform=process.platform;state.arch=process.arch;
  await writeFile(join(runtime,'startup.json'),JSON.stringify(state));
 }
 const requirements=digest(await readFile('scripts/translation-requirements.txt'));let ready={};try{ready=JSON.parse(await readFile(join(runtime,'translation-ready.json'),'utf8'));}catch{}
 const python=join(root,process.platform==='win32'?'.venv/Scripts/python.exe':'.venv/bin/python');
 try{
  if(ready.platform!==process.platform||ready.arch!==process.arch||ready.requirements!==requirements||!existsSync(python)||!existsSync('.runtime/argos/packages'))await node(['scripts/setup-translation.mjs']);
 }catch(error){console.warn('Türkçe çeviri hazırlanamadı. Uygulama açılacak; sonraki açılışta tekrar denenecek. '+error.message);}
 const build=await fingerprint(['src/','public/','App.tsx','index.ts','app.json','package-lock.json']);
 if(!existsSync('dist/index.html')||state.build!==build){await node(['scripts/prepare-pdf.mjs']);await node(['node_modules/expo/bin/cli','export','--platform','web']);state.build=await fingerprint(['src/','public/','App.tsx','index.ts','app.json','package-lock.json']);await writeFile(join(runtime,'startup.json'),JSON.stringify(state));}
 console.log('English Desk: '+address+' — Durdurmak için Ctrl+C');
 const server=spawn(process.execPath,['--use-system-ca','scripts/serve.mjs'],{cwd:root,env,stdio:'inherit',windowsHide:true});
 const stopped=new Promise((resolve,reject)=>{server.on('error',reject);server.on('exit',code=>code===0?resolve():reject(Error(`Yerel sunucu durdu (${code}).`)));});
 stopped.catch(()=>{});
 if(await waitForServer())openBrowser();
 else console.warn('Tarayıcı otomatik açılmadı. Sunucu açıldığında şu adresi kullan: '+address);
 await stopped;
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
