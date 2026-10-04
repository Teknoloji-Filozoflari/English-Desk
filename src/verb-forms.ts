import type { VerbForms } from './model';
const irregular = [
  ['bring','brought','brought'], ['buy','bought','bought'], ['think','thought','thought'],
  ['teach','taught','taught'], ['catch','caught','caught'], ['go','went','gone'],
  ['come','came','come'], ['do','did','done'], ['be','was / were','been'],
  ['have','had','had'], ['take','took','taken'], ['give','gave','given'],
  ['see','saw','seen'], ['write','wrote','written'], ['speak','spoke','spoken'],
  ['eat','ate','eaten'], ['drink','drank','drunk'], ['make','made','made'],
  ['find','found','found'], ['leave','left','left'], ['feel','felt','felt'],
  ['know','knew','known'], ['get','got','got / gotten'], ['tell','told','told'],
  ['say','said','said'], ['run','ran','run'], ['meet','met','met'],
  ['keep','kept','kept'], ['sleep','slept','slept'], ['lose','lost','lost'],
  ['send','sent','sent'], ['build','built','built'], ['stand','stood','stood'],
  ['understand','understood','understood'], ['choose','chose','chosen'], ['break','broke','broken'],
];
const regular = [
  ['work','worked'], ['play','played'], ['walk','walked'], ['talk','talked'],
  ['want','wanted'], ['need','needed'], ['ask','asked'], ['look','looked'],
  ['listen','listened'], ['like','liked'], ['love','loved'], ['live','lived'],
  ['use','used'], ['try','tried'], ['study','studied'], ['stop','stopped'],
  ['start','started'], ['open','opened'], ['close','closed'], ['help','helped'],
  ['watch','watched'], ['call','called'], ['visit','visited'], ['wait','waited'],
];
export function lookupVerbForms(word: string): VerbForms | undefined {
  const key = word.trim().toLowerCase();
  const row = irregular.find(forms => forms.some(form => form.split(' / ').includes(key)));
  if (row) return { base: row[0], past: row[1], participle: row[2], regularity: 'irregular' };
  const normal = regular.find(forms => forms.includes(key));
  if (normal) return { base: normal[0], past: normal[1], participle: normal[1], regularity: 'regular' };
}
