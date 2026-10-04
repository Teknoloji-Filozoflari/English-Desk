export const TENSE_GROUPS = [
  { title: 'Present', subtitle: 'Şimdiki ve genel zamanlar', tenses: ['Present Simple', 'Present Continuous', 'Present Perfect', 'Present Perfect Continuous'] },
  { title: 'Past', subtitle: 'Geçmiş zamanlar', tenses: ['Past Simple', 'Past Continuous', 'Past Perfect', 'Past Perfect Continuous'] },
  { title: 'Future', subtitle: 'Gelecek zamanlar', tenses: ['Future Simple', 'Future Continuous', 'Future Perfect', 'Future Perfect Continuous'] },
] as const;

export type TenseName = typeof TENSE_GROUPS[number]['tenses'][number];
export const isTenseName = (value: unknown): value is TenseName =>
  typeof value === 'string' && TENSE_GROUPS.some(group => group.tenses.some(tense => tense === value));
