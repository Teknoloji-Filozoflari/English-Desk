import { readFileSync } from 'node:fs';
import { normalizePos, normalizeWord } from './cefr.mjs';
const rows=['study-examples.tsv','connector-examples.tsv','phrasal-examples.tsv','prep-examples.tsv','prepositions-examples.tsv'].flatMap(file=>readFileSync(new URL('../resources/yds/'+file,import.meta.url),'utf8').trim().split(/\r?\n/).map(line=>line.split('\t')));
const entries=new Map(rows.map(([word,type,example,translation])=>[`${normalizeWord(word)}|${normalizePos(type)}`,{example,translation,sources:'Uygulama için hazırlanmış çalışma örneği ve Türkçe çevirisi (sözlük alıntısı değildir).'}]));
export function lookupStudyExample(word,type){return entries.get(`${normalizeWord(word)}|${normalizePos(type)}`)??null;}
