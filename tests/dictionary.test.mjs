import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLevelLookup, lookupLevel } from '../scripts/cefr.mjs';
import { dictionaryEntry, createDictionaryService } from '../scripts/dictionary.mjs';
import { lookupOffline } from '../scripts/offline-dictionary.mjs';
import { addRelatedCards, mergeLookup, relatedWords } from '../src/word-enrichment.ts';
import { validateNotebook, wordLevel } from '../src/model.ts';
const word = {id:'w',word:'quiet',meaning:'sessiz',type:'adjective',synonyms:'silent, peaceful (bağlama göre), SILENT',antonyms:'noisy, quiet',example:'My own sentence.',translation:'Benim cümlem.',storyId:'',level:''};
const notebook = () => ({version:1,stories:[],words:[{...word}],grammar:[]});
test('İlişkiler tekrarlanmaz, açıklama kelime olmaz ve yeni kart hikaye seviyesi almaz',()=>{
  assert.deepEqual(relatedWords(word),['silent','peaceful','noisy']);
  let n=0;const next=addRelatedCards(notebook(),word,()=>String(++n));
  assert.equal(next.words.length,4); assert.equal(next.words[1].generatedFrom,'quiet');
  assert.equal(next.words[1].type,'adjective');
  assert.equal(wordLevel(next.words[1],[]),''); assert.equal(addRelatedCards(next,word,()=>String(++n)).words.length,4);
  assert.equal(notebook().words.length,1);assert.equal(validateNotebook(next).words[1].meaning,'');
});
test('Otomatik alanlar dosya/yedek turunda korunur ve geçersiz metadata reddedilir',()=>{
  const data=notebook();data.words[0]={...word,definition:'Not noisy.',levelSource:'CEFR-J 1.5',sources:'https://dictionaryapi.dev/',generatedFrom:'calm'};
  assert.deepEqual(validateNotebook(JSON.parse(JSON.stringify(data))).words,data.words);
  assert.throws(()=>validateNotebook({...data,words:[{...word,definition:{bad:true}}]}));
});
test('Dolu alanlar ve farklı örneğe ait çeviri korunur; seviye yoksa kaynaklı atanır',()=>{
  const result={word:'quiet',meaning:'makine',definition:'A definition.',type:'noun',synonyms:'calm',antonyms:'loud',example:'Another sentence.',translation:'Başka cümle.',level:'A2',levelSource:'CEFR-J',sources:'dictionary',warnings:[]};
  const next=mergeLookup(word,result);assert.equal(next.meaning,'sessiz');assert.equal(next.example,word.example);assert.equal(next.translation,word.translation);assert.equal(next.level,'A2');
  assert.equal(mergeLookup({...word,translation:''},result).translation,'');
  assert.equal(mergeLookup({...word,level:'C1'},result).level,'C1');
});
test('CEFR kelime türünü ayırır, belirsiz veya bulunamayan kelimeye seviye uydurmaz',()=>{
  const lookup=createLevelLookup([{source:'test',text:'headword,pos,CEFR\nact,noun,A2\nact,verb,B1\ncolor/colour,noun,A1\n'}]);
  assert.equal(lookup('act','fiil').level,'B1');assert.equal(lookup('act').level,'');assert.equal(lookup('colour','noun').level,'A1');assert.equal(lookup('missing','noun').level,'');assert.equal(lookupLevel('timid','adjective').level,'C1');
});
const entry=[{license:{name:'CC BY-SA 3.0',url:'https://creativecommons.org/licenses/by-sa/3.0/'},sourceUrls:['https://en.wiktionary.org/wiki/quiet'],meanings:[{partOfSpeech:'noun',definitions:[{definition:'Silence.'}]},{partOfSpeech:'adjective',synonyms:['calm'],definitions:[{definition:'Not noisy.',example:'A quiet room.',antonyms:['noisy']}]}]}];
test('Sözlükte istenen kelime türü seçilir ve kaynak/lisans korunur',()=>{const result=dictionaryEntry(entry,'Sıfat');assert.equal(result.definition,'Not noisy.');assert.equal(result.type,'adjective');assert.match(result.sources,/CC BY-SA/);assert.deepEqual(result.antonyms,['noisy']);});
test('İstenen kelime türü yoksa başka türün anlamı kullanılmaz',()=>{assert.equal(dictionaryEntry(entry,'verb').definition,'');});
test('Sözlük bulunamazsa Datamuse tam kelime ve tür eşleşmesiyle yedek açıklama sağlar',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'english-dictionary-'));
  try {
    const lookup=createDictionaryService({directory,offline:()=>null,fetcher:async url=>url.includes('dictionaryapi')?new Response('{}',{status:404}):new Response(JSON.stringify(url.includes('qe=sp')?[{word:'quiet',defs:['n\tSilence.','adj\tNot noisy.']}]:[])),translate:async()=>['Sessiz.','']});
    const result=await lookup({word:'quiet',type:'adjective'});assert.equal(result.definition,'Not noisy.');assert.match(result.sources,/Datamuse açıklaması/);assert.equal(result.meaning,'Sessiz.');
  } finally {await rm(directory,{recursive:true,force:true});}
});
test('API önbelleği tekrar isteği önler; kullanıcının örneği yerel çeviriye gider',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'english-dictionary-'));let calls=0;let texts;
  try{
    const lookup=createDictionaryService({directory,fetcher:async url=>{calls++;return new Response(JSON.stringify(url.includes('dictionaryapi')?entry:[{word:'silent'}]));},translate:async input=>{texts=input;return ['Sessiz.','Benim örneğim.'];}});
    const result=await lookup({word:'quiet',type:'adjective',example:'My example.'});assert.equal(result.meaning,'Sessiz.');assert.equal(texts[1],'My example.');assert.ok(result.level);assert.equal(result.warnings.length,0);
    await lookup({word:'quiet',type:'adjective',example:'My example.'});assert.equal(calls,1);
  }finally{await rm(directory,{recursive:true,force:true});}
});
test('İnternet ve çeviri arızasında WordNet açıklaması ve yerel seviye korunur',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'english-dictionary-'));
  try{const lookup=createDictionaryService({directory,fetcher:async()=>{throw Error('offline');},translate:async()=>{throw Error('not installed');}});const result=await lookup({word:'quiet',type:'adjective'});assert.equal(result.meaning,'');assert.match(result.definition,/absence/);assert.ok(result.level);assert.match(result.sources,/WordNet/);assert.ok(result.warnings.length>=2);await assert.rejects(lookup({word:'../../secret'}));}
  finally{await rm(directory,{recursive:true,force:true});}
});

test('WordNet yalnız doğru kelime türüyle eşleşir',()=>{
  assert.match(lookupOffline('quiet','adjective').definition,/absence/);
  assert.equal(lookupOffline('quiet','conjunction'),null);
  assert.equal(lookupOffline('book'),null);
});

test('istek sınırı tekrar denenmez ve çevrimdışı açıklama korunur',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'english-dictionary-'));let calls=0;
  try {
    const lookup=createDictionaryService({directory,fetcher:async()=>{calls++;return new Response('',{status:429,headers:{'retry-after':'60'}});},translate:async()=>['Sessiz.','']});
    const result=await lookup({word:'quiet',type:'adjective'});
    assert.equal(calls,1);assert.match(result.definition,/absence/);
    assert.ok(result.warnings.some(message=>message.includes('istek sınırına')));
  } finally {await rm(directory,{recursive:true,force:true});}
});

test('süresi dolmuş başarılı önbellek servis arızasında kullanılmaya devam eder',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'english-dictionary-'));
  try {
    const first=createDictionaryService({directory,fetcher:async()=>new Response(JSON.stringify(entry)),translate:async()=>['Sessiz.','']});
    await first({word:'quiet',type:'adjective'});
    const {readdir,readFile,writeFile}=await import('node:fs/promises');
    for(const filename of await readdir(directory)) { const path=join(directory,filename); const cached=JSON.parse(await readFile(path,'utf8')); cached.expires=1; await writeFile(path,JSON.stringify(cached)); }
    const second=createDictionaryService({directory,fetcher:async()=>{throw Error('offline');},translate:async()=>{throw Error('offline');}});
    const result=await second({word:'quiet',type:'adjective'});
    assert.equal(result.definition,'Not noisy.');
    assert.equal(result.meaning,'Sessiz.');
    assert.ok(result.warnings.some(message=>message.includes('önbellek')));
  } finally {await rm(directory,{recursive:true,force:true});}
});

test('önbellek klasörü yazılamasa da alınan sözlük bilgisi korunur',async()=>{
  const root=await mkdtemp(join(tmpdir(),'english-dictionary-'));
  try {
    const {writeFile}=await import('node:fs/promises');
    const directory=join(root,'not-a-directory');
    await writeFile(directory,'blocked');
    const lookup=createDictionaryService({directory,fetcher:async()=>new Response(JSON.stringify(entry)),translate:async()=>['Sessiz.','']});
    const result=await lookup({word:'quiet',type:'adjective'});
    assert.equal(result.definition,'Not noisy.');assert.equal(result.meaning,'Sessiz.');
  } finally {await rm(root,{recursive:true,force:true});}
});

test('Sözlük önerileri boş eş/zıt anlam alanlarını doldurmaz ve ek kart üretmez',()=>{
 const original={...word,synonyms:'',antonyms:''};
 const result={word:'quiet',meaning:'sessiz',definition:'Not noisy.',type:'adjective',synonyms:'calm, peaceful',antonyms:'loud, noisy',example:'',translation:'',level:'A1',levelSource:'CEFR-J',sources:'dictionary',warnings:[]};
 const merged=mergeLookup(original,result);
 assert.equal(merged.synonyms,'');assert.equal(merged.antonyms,'');
 assert.equal(addRelatedCards({...notebook(),words:[merged]},merged,()=> 'new').words.length,1);
 const manual=mergeLookup({...original,synonyms:'silent',antonyms:'loud'},result);
 let count=0;const data=addRelatedCards({...notebook(),words:[manual]},manual,()=> 'new'+(++count));
 assert.deepEqual(data.words.map(w=>w.word),['quiet','silent','loud']);
});
