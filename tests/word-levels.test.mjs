import test from 'node:test';
import assert from 'node:assert/strict';
import { wordLevel, groupWords, removeStory, validateNotebook } from '../src/model.ts';
const story={id:'s',title:'Story',text:'Text',level:'A2',read:false};
const word={id:'w',word:'quiet',meaning:'sessiz',type:'',synonyms:'',antonyms:'',example:'',translation:'',storyId:'s'};
test('Eski kelime hikâyesinin seviyesini alır; açık seçim önceliklidir',()=>{assert.equal(wordLevel(word,[story]),'A2');assert.equal(wordLevel({...word,level:'B2'},[story]),'B2');assert.equal(groupWords([word],[story]).groups[1].words.length,1);});
test('Hikâye silinse de kelimenin seviyesi korunur',()=>{const result=removeStory({version:1,stories:[story],words:[word],grammar:[]},'s');assert.equal(result.words[0].level,'A2');assert.equal(result.words[0].storyId,'');});
test('Kelime seviyesi yedekte korunur ve geçersiz seviye reddedilir',()=>{const data={version:1,stories:[story],words:[{...word,level:'C1'}],grammar:[]};assert.equal(validateNotebook(data).words[0].level,'C1');assert.throws(()=>validateNotebook({...data,words:[{...word,level:'D1'}]}));});
