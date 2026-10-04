import test from 'node:test';
import assert from 'node:assert/strict';
import {validateNotebook} from '../src/model.ts';
test('PDF examples survive validation with translations and sources',()=>{
 const card={id:'w',word:'example',meaning:'örnek',type:'noun',synonyms:'',antonyms:'',example:'',translation:'',storyId:'',examples:[{example:'This is an example.',translation:'Bu bir örnek.',source:'PDF sayfa 3'}]};
 const data={version:1,stories:[],words:[card],grammar:[]};
 assert.deepEqual(validateNotebook(data).words[0].examples,card.examples);
 assert.throws(()=>validateNotebook({...data,words:[{...card,examples:[{example:'',translation:'',source:''}]}]}));
 assert.throws(()=>validateNotebook({...data,words:[{...card,examples:[{example:'sentence',translation:42,source:''}]}]}));
});
