import test from 'node:test';
import assert from 'node:assert/strict';
import { dictionaryEntry } from '../scripts/dictionary.mjs';
import { mergeExample, needsExample } from '../scripts/word-examples.mjs';
import {lookupStudyExample} from '../scripts/study-examples.mjs';
test('example can be found in later definitions of the requested part of speech',()=>{
 const payload=[{meanings:[{partOfSpeech:'noun',definitions:[{definition:'An act.'},{definition:'A decision.',example:'It was a difficult choice.'}]},{partOfSpeech:'verb',definitions:[{definition:'Select.',example:'Choose a book.'}]}]}];
 assert.equal(dictionaryEntry(payload,'noun').example,'It was a difficult choice.');assert.equal(dictionaryEntry(payload,'verb').example,'Choose a book.');
});
test('prepared examples distinguish noun and verb and preserve Turkish characters',()=>{
 assert.match(lookupStudyExample('guide','noun').example,/Our guide/);
 assert.match(lookupStudyExample('guide','verb').example,/will guide/);
 assert.match(lookupStudyExample('admire','verb').translation,/hayranım/);
 assert.match(lookupStudyExample('admire','verb').sources,/sözlük alıntısı değildir/);
 assert.equal(lookupStudyExample('unlisted','noun'),null);
});
test('filling examples preserves user meaning and existing examples; sources are appended',()=>{
 const word={word:'choice',type:'noun',meaning:'seçim',example:'',translation:'',sources:'PDF'};
 assert.equal(needsExample(word),true);
 const next=mergeExample(word,{example:'It was a difficult choice.',sources:'Dictionary'});
 assert.equal(next.meaning,'seçim');assert.equal(next.sources,'PDF\nDictionary');
 assert.equal(mergeExample(next,{example:'Replace me.'}),next);assert.equal(mergeExample(word,null),word);
});
