import test from 'node:test';
import assert from 'node:assert/strict';
import {createExtendedLevelLookup} from '../scripts/extended-levels.mjs';
import {lookupLevel} from '../scripts/cefr.mjs';
const empty=()=>({level:'',levelSource:'',levelNote:'not found'});
test('exact levels take precedence over estimates and reviewed entries',()=>{
 const lookup=createExtendedLevelLookup(()=>({level:'B1',levelSource:'verified'}),[['sample','noun','C2']],[{word:'sample',type:'noun',level:'B2',source:'review'}]);
 assert.equal(lookup('sample','noun').level,'B1');assert.equal(lookup('sample','noun').levelSource,'verified');
});
test('estimates match the complete word and part of speech and remain labelled',()=>{
 const lookup=createExtendedLevelLookup(empty,[['give','verb','A1'],['sample','noun','B2']],[]);
 assert.equal(lookup('sample','noun').level,'B2');assert.match(lookup('sample','noun').levelSource,/Tahmini/);
 assert.equal(lookup('sample','verb').level,'');assert.equal(lookup('give up','phrasal verb').level,'');assert.equal(lookup('unknown','noun').level,'');
});
test('reviewed phrase levels preserve source and normalize spacing without inventing matches',()=>{
 const lookup=createExtendedLevelLookup(empty,[],[{word:'keep up with',type:'phrasal verb',level:'B1',source:'Tahmini çalışma seviyesi'}]);
 assert.equal(lookup(' KEEP   UP WITH ','phrasal verb').level,'B1');assert.equal(lookup('keep up with','noun').level,'');
});
test('bundled data resolves imported phrases and corrected noun independently from the verb',()=>{
 assert.equal(lookupLevel('remains','noun').level,'B2');assert.ok(lookupLevel('remain','verb').level);
 assert.equal(lookupLevel('keep up with','phrasal verb').level,'B1');assert.match(lookupLevel('keep up with','phrasal verb').levelSource,/Tahmini/);
 assert.equal(lookupLevel('zzzz-nonexistent','noun').level,'');
});
