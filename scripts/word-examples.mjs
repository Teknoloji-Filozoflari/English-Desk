import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { lookupOffline } from './offline-dictionary.mjs';
import { dictionaryEntry } from './dictionary.mjs';
import { normalizePos } from './cefr.mjs';
import { lookupStudyExample } from './study-examples.mjs';
const directory=new URL('../data/example-cache/',import.meta.url);
export function needsExample(word){return ['noun','verb','adjective','adverb','conjunction'].includes(normalizePos(word.type))&&!word.example?.trim();}
export function mergeExample(word,result){
 if(!needsExample(word)||!result?.example)return word;
 return {...word,example:result.example,translation:result.translation??'',sources:[...new Set([word.sources,result.sources].filter(Boolean).flatMap(s=>s.split('\n')))].join('\n')};
}
export function createExampleLookup({offline=lookupOffline,fetcher=fetch,cacheDirectory=directory}={}){
 let blockedUntil=0;
 return async word=>{
  const local=offline(word.word,word.type);if(local?.example)return {example:local.example,sources:local.sources};
  const prepared=lookupStudyExample(word.word,word.type);if(prepared)return prepared;
  const file=new URL(createHash('sha256').update(word.word.toLowerCase()+'|'+normalizePos(word.type)).digest('hex')+'.json',cacheDirectory);
  try{const saved=JSON.parse(await readFile(file,'utf8'));if(saved.example||saved.retryAfter>Date.now())return saved;}catch{}
  if(Date.now()<blockedUntil)return null;
  try{
   const response=await fetcher(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.word.toLowerCase())}`,{signal:AbortSignal.timeout(10000)});
   if(response.status===429){blockedUntil=Date.now()+60000;return null;}
   if(!response.ok&&response.status!==404)throw Error('Dictionary HTTP '+response.status);
   const entry=response.ok?dictionaryEntry(await response.json(),word.type):{};
   const result={example:entry.example??'',sources:entry.sources??'',retryAfter:Date.now()+86400000};
   await mkdir(cacheDirectory,{recursive:true});await writeFile(file,JSON.stringify(result));return result;
  }catch{blockedUntil=Date.now()+60000;return null;}
 };
}
export const lookupExample=createExampleLookup();
export async function fillExamples(store,lookup=lookupExample,onProgress=()=>{}){
 const snapshot=await store.read();if(!snapshot.data)return {added:0,missing:0};
 const pending=snapshot.data.words.filter(needsExample);let added=0,completed=0;
 for(let i=0;i<pending.length;i+=50){
  const batch=pending.slice(i,i+50);
  const results=[];for(let j=0;j<batch.length;j+=2)results.push(...await Promise.all(batch.slice(j,j+2).map(async word=>({word,result:await lookup(word)}))));
  if(results.some(item=>item.result?.example))for(let attempt=0;attempt<3;attempt++){
   const current=await store.read();const words=current.data.words.map(word=>{
    const item=results.find(item=>item.word.id===word.id&&item.word.word===word.word&&item.word.type===word.type);
    return item?mergeExample(word,item.result):word;
   });
   const count=words.filter((word,j)=>word!==current.data.words[j]).length;if(!count)break;
   try{await store.save({...current.data,words},current.revision);added+=count;break;}catch(error){if(attempt===2)throw error;}
  }
  completed+=batch.length;if(completed%50===0||completed===pending.length)onProgress({completed,total:pending.length,added});
 }
 const after=await store.read();return {added,missing:after.data.words.filter(needsExample).length};
}
