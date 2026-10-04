import test from 'node:test';
import assert from 'node:assert/strict';
import {successChapters,storyLibraryItems,SUCCESS_SERIES} from '../src/story-series.ts';
const chapter = n => ({id:'b1b2-effortless-success-chapter-'+n,title:'Effortless Success - Chapter '+n,text:'content '+n,level:'B2',read:n===1});
test('series stays one item across pagination and chapters are ordered without mutating data',()=>{
 const rows=[chapter(5),{id:'other',title:'Other',text:'other',level:'B1',read:false},chapter(1),chapter(3),chapter(2),chapter(4)];
 const original=JSON.stringify(rows); const items=storyLibraryItems(rows);
 assert.equal(items.length,2); assert.equal(items.filter(s=>s.id===SUCCESS_SERIES).length,1);
 const series=items.find(s=>s.id===SUCCESS_SERIES);assert.deepEqual(series.members.map(s=>s.id),[1,2,3,4,5].map(n=>chapter(n).id));
 assert.equal(series.read,false);assert.ok(series.search.includes('content 3'));assert.equal(JSON.stringify(rows),original);
});
test('deleted chapters are omitted and a renamed chapter retains membership',()=>{
 const rows=[chapter(5),{...chapter(2),title:'Renamed',read:true}];
 assert.deepEqual(successChapters(rows).map(s=>s.id),[chapter(2).id,chapter(5).id]);
 assert.equal(storyLibraryItems(rows)[0].members.length,2);
 assert.deepEqual(storyLibraryItems([]),[]);
 assert.equal(storyLibraryItems([{...chapter(1),read:true}])[0].read,true);
});
