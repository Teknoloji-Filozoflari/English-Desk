import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';

const levels=['A1','A2','B1','B2','C1','C2'];
const normalize=value=>value.trim().toLowerCase().replace(/[’]/g,"'").replace(/\s+/g,' ');
const pos=value=>({'phrasal verb':'verb','öbek fiil':'verb',fiil:'verb',isim:'noun',sıfat:'adjective',zarf:'adverb',edat:'preposition',bağlaç:'conjunction',belirleyici:'determiner'})[normalize(value)]??normalize(value);
export function createExtendedLevelLookup(primary,computed,reviewed){
 const estimates=new Map(computed.map(([word,type,level])=>[normalize(word)+'|'+pos(type),level]));
 const reviews=new Map(reviewed.map(row=>[normalize(row.word)+'|'+pos(row.type),row]));
 return (word,type='')=>{
  const direct=primary(word,type);if(direct.level)return direct;
  const key=normalize(word)+'|'+pos(type),review=reviews.get(key);
  if(review&&levels.includes(review.level))return {level:review.level,levelSource:review.source,levelNote:''};
  const estimated=estimates.get(key);
  if(levels.includes(estimated))return {level:estimated,levelSource:'Tahmini CEFR — Words-CEFR-Dataset, Belikov Maxim (MIT); kelime türü ve kullanım sıklığına dayalı hesaplama. https://github.com/Maximax67/Words-CEFR-Dataset',levelNote:''};
  return direct;
 };
}
export function loadExtendedLevels(primary){
 const computed=gunzipSync(readFileSync(new URL('../resources/cefr/computed-levels.csv.gz',import.meta.url))).toString('utf8').trim().split('\n').map(line=>line.split(','));
 const reviewed=JSON.parse(readFileSync(new URL('../resources/cefr/reviewed-levels.json',import.meta.url),'utf8'));
 return createExtendedLevelLookup(primary,computed,reviewed);
}
