import test from 'node:test';
import assert from 'node:assert/strict';
import {createComponentLevelLookup} from '../scripts/component-levels.mjs';
const empty={level:'',levelSource:'',levelNote:'missing'};
test('full expression has priority over its easier individual words',()=>{
 const lookup=createComponentLevelLookup((w,t)=>w==='give up'&&t==='phrasal verb'?{level:'B1',levelSource:'full'}:w==='give'||w==='up'?{level:'A1',levelSource:'word'}:empty);
 assert.equal(lookup('give up','phrasal verb').level,'B1');assert.equal(lookup('give up','phrasal verb').levelSource,'full');
});
test('whole expression is considered across phrase labels before component estimation',()=>{
 const lookup=createComponentLevelLookup((w,t)=>w==='in general'&&t==='adverb'?{level:'B1',levelSource:'phrase'}:w==='in'||w==='general'?{level:'A1',levelSource:'word'}:empty);
 assert.equal(lookup('in general','preposition').level,'B1');assert.match(lookup('in general','preposition').levelSource,/tam ifade/);
});
test('component estimates state their method and do not invent levels for unknown words',()=>{
 const lookup=createComponentLevelLookup(w=>w==='cold'?{level:'A1'}:w==='water'?{level:'A2'}:empty);
 assert.equal(lookup('cold water','phrase').level,'A2');assert.match(lookup('cold water','phrase').levelSource,/Tahmini.*cold=A1, water=A2/);
 assert.equal(lookup('cold unknownword','phrase').level,'');assert.equal(lookup('unknownword','noun').level,'');
});
