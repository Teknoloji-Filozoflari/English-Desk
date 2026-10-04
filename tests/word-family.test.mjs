import test from 'node:test';
import assert from 'node:assert/strict';
import { addFamilyCard } from '../src/word-family.ts';
import { validateNotebook } from '../src/model.ts';
const member={word:'decide',meaning:'karar vermek',type:'verb',level:'A2',levelSource:'local'};
const parent={id:'decision',word:'decision',meaning:'karar',type:'noun',synonyms:'',antonyms:'',example:'',translation:'',storyId:'',sources:'PDF',family:[member]};
const data={version:1,stories:[],words:[parent],grammar:[]};
test('family survives persistence; adding a member keeps its meaning, level and parent link',()=>{
 const checked=validateNotebook(data);assert.deepEqual(checked.words[0].family,[member]);
 const result=addFamilyCard(checked,parent,member,()=> 'decide');
 assert.equal(result.data.words.length,2);assert.equal(result.card.meaning,member.meaning);assert.equal(result.card.level,'A2');assert.equal(result.card.generatedFrom,'decision');assert.equal(result.card.family[0].word,'decision');
 assert.deepEqual(validateNotebook(result.data).words[1].family,result.card.family);
});
test('existing card opens without duplicate or overwriting user content',()=>{
 const added=addFamilyCard(data,parent,member,()=> 'decide');
 const result=addFamilyCard(added.data,parent,{...member,word:'Decide'},()=>{throw Error('must not create');});
 assert.equal(result.data,added.data);assert.equal(result.card,added.card);
});
test('invalid family is rejected',()=>{
 assert.throws(()=>validateNotebook({...data,words:[{...parent,family:[{...member,level:'YDS'}]}]}));
});
test('same spelling with a different part of speech keeps separate meanings',()=>{
 const noun={...parent,word:'decide'};
 const result=addFamilyCard({...data,words:[noun]},parent,member,()=> 'verb-decide');
 assert.equal(result.data.words.length,2);assert.equal(result.card.type,'verb');assert.equal(result.data.words[0].meaning,noun.meaning);
});
