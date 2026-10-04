import test from 'node:test';
import assert from 'node:assert/strict';
import {pageSlice} from '../src/pagination.ts';
test('10 bin kayıt sayfalarda eksiksiz ve tekrarsız gezinilir; aynı anda en fazla 24 kayıt',()=>{const rows=Array.from({length:10000},(_,i)=>i);const all=[];for(let p=1;p<=Math.ceil(rows.length/24);p++){const result=pageSlice(rows,p);assert.ok(result.rows.length<=24);all.push(...result.rows);}assert.deepEqual(all,rows);});
test('Filtreleme veya silme sonrası geçersiz sayfa son geçerli sayfaya iner',()=>{assert.equal(pageSlice([1,2],40).page,1);assert.deepEqual(pageSlice([],9),{page:1,pages:1,total:0,start:0,end:0,rows:[]});assert.equal(pageSlice([1,2],0).page,1);});
