import test from 'node:test';
import assert from 'node:assert/strict';
import {validateNotebook,removeStory} from '../src/model.ts';
test('one card can belong to multiple stories and deletion preserves remaining links',()=>{
 const stories=['a','b'].map(id=>({id,title:id,text:'Text.',level:'B1',read:false}));
 const word={id:'w',word:'test',meaning:'test',type:'noun',synonyms:'',antonyms:'',example:'',translation:'',storyId:'a',storyIds:['a','b']};
 const data=validateNotebook({version:1,stories,words:[word],grammar:[]});
 assert.deepEqual(data.words[0].storyIds,['a','b']);
 const removed=validateNotebook(removeStory(data,'a'));assert.deepEqual(removed.words[0].storyIds,['b']);assert.equal(removed.words[0].storyId,'');assert.equal(removed.words.length,1);
 assert.throws(()=>validateNotebook({...data,words:[{...word,storyIds:['missing']}]}));
});
