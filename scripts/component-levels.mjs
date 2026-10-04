const bands=['A1','A2','B1','B2','C1','C2'];
const types=['noun','verb','adjective','adverb','preposition','conjunction','determiner','pronoun'];
const ignored=new Set(['sb','sth','svo','someone','somebody','something']);
export function createComponentLevelLookup(exact){
 return (word,type='')=>{
  const full=exact(word,type);if(full.level)return full;
  const tokens=word.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g)??[];
  if(tokens.length<2)return full;
  // Match the whole expression across phrase labels before looking at its parts.
  const matches=['phrase','preposition','phrasal verb','adverb','conjunction','noun'].map(t=>exact(word,t)).filter(r=>r.level);
  const distinct=[...new Set(matches.map(r=>r.level))];
  if(distinct.length===1)return {level:distinct[0],levelSource:'Tahmini çalışma seviyesi — tam ifade, farklı kalıp/kelime türü etiketiyle eşleşti. '+matches[0].levelSource,levelNote:''};
  const parts=[];
  for(const token of [...new Set(tokens)].filter(t=>!ignored.has(t))){
   const found=types.map(t=>exact(token,t)).filter(r=>r.level);
   if(!found.length)return {...full,levelNote:'İfade içindeki bir kelime için seviye bulunamadı: '+token};
   const level=found.map(r=>r.level).sort((a,b)=>bands.indexOf(a)-bands.indexOf(b))[0];
   parts.push({token,level});
  }
  if(!parts.length)return full;
  const level=parts.map(p=>p.level).sort((a,b)=>bands.indexOf(b)-bands.indexOf(a))[0];
  return {level,levelSource:'Tahmini çalışma seviyesi — tam kalıp bulunamadı; bileşenlerin yaygın kelime türlerindeki ilk öğrenim seviyeleri incelendi ve en yüksek düzey seçildi: '+parts.map(p=>p.token+'='+p.level).join(', ')+'. Bu yöntem kalıbın mecaz anlamını doğrulamaz.',levelNote:''};
 };
}
