import {readFile,readdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {parseLinguaText} from './import-lingua-level.mjs';
import {validateNotebook} from '../src/model.ts';
const root=process.argv[2];
if(!root)throw Error('Source folder required');
const stories=[],errors=[];
for(const level of ['A1','A2','B1','B2','C1','C2']){
 let names;try{names=await readdir(join(root,level));}catch(e){if(e.code==='ENOENT')continue;throw e;}
 for(const name of names.filter(n=>/\.pdf$/i.test(n)).sort()){
  try{
   const task=getDocument({data:new Uint8Array(await readFile(join(root,level,name))),useSystemFonts:true,verbosity:0});
   const pdf=await task.promise;let raw='',found=false;
   for(let p=1;p<=pdf.numPages&&!found;p++){
    const page=await pdf.getPage(p);const items=(await page.getTextContent()).items.filter(i=>i.str?.trim()&&i.transform[5]>45&&!/^T:\s*\d{2}\.\d{2}\.\d{4}/.test(i.str.trim())&&!/^\d+\/\d+$/.test(i.str.trim())).sort((a,b)=>b.transform[5]-a.transform[5]||a.transform[4]-b.transform[4]);
    const lines=[];
    for(const i of items){let line=lines.at(-1);if(!line||Math.abs(line.y-i.transform[5])>2){line={y:i.transform[5],items:[]};lines.push(line);}line.items.push(i);}
    let prev;
    for(const line of lines){const text=line.items.sort((a,b)=>a.transform[4]-b.transform[4]).map(i=>i.str).join(' ').replace(/\s+/g,' ').trim();if(prev!==undefined&&prev-line.y>20)raw+='\n';raw+=text+'\n';prev=line.y;if(text==='Did you understand the text?'){found=true;break;}}
   }
   const extracted=parseLinguaText(raw,level);
   const slug=name.replace(/\.pdf$/i,'').replaceAll('ı','i').normalize('NFKD').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase();
   stories.push({id:`lingua-${level.toLowerCase()}-${slug}`,...extracted,level,read:false,sample:false,sourceName:`Lingua/${level}/${name}`});
  }catch(e){errors.push({level,name,error:e.message});}
 }
 console.log(level,stories.filter(s=>s.level===level).length);
}
await writeFile('data/lingua-import-draft.json',JSON.stringify({stories,errors},null,2));
console.log('Extracted',stories.length,'Errors',JSON.stringify(errors));
if(process.argv.includes('--save')){
 if(errors.length)throw Error('Review extraction errors before saving');
 const endpoint='http://127.0.0.1:8081/api/notebook';const current=await(await fetch(endpoint)).json();
 const normalized=s=>s.replace(/\s+/g,' ').trim().toLowerCase();const additions=[];
 for(const story of stories){if(![...current.data.stories,...additions].some(s=>s.id===story.id||s.sourceName===story.sourceName||normalized(s.text)===normalized(story.text)))additions.push(story);}
 const data=validateNotebook({...current.data,stories:[...current.data.stories,...additions]});
 const r=await fetch(endpoint,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:current.revision,data})});if(!r.ok)throw Error(await r.text());
 const check=await(await fetch(endpoint)).json();for(const s of additions){const saved=check.data.stories.find(x=>x.id===s.id);if(saved?.text!==s.text||saved?.level!==s.level)throw Error('Verification failed: '+s.title);}
 console.log(JSON.stringify({added:additions.length,skipped:stories.length-additions.length,total:check.data.stories.length,levels:Object.fromEntries(['A1','A2','B1','B2','C1'].map(l=>[l,additions.filter(s=>s.level===l).length]))}));
}
