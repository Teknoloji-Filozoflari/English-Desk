export const MODALITY_TOPICS = [
  '3.1 Ability (yetenek)',
  '3.2 Possibility (olasılık)',
  '3.3 Request (rica)',
  '3.4 Permission (izin)',
  '3.5 Obligation & Necessity (zorunluluk)',
  '3.6 Advice (tavsiye)',
  '3.7 Deduction (sonuç çıkarımı)',
  '3.8 Habitual Activities (alışkanlık)',
  '3.9 Preference (tercih)',
  '3.10 Prohibition (yasaklama)',
  '3.11 Expectation (beklenti)',
  '3.12 Asking Opinion, Offer (Akıl danışma, öneri)',
  '3.13 Modality Progressive (modal + be Ving)',
  '3.14 Modality Perfect (modal + have V3)',
  '3.15 Unreal yapılar özeti',
  '3.16 “Must” tablosu',
] as const;

export type ModalityTopic = typeof MODALITY_TOPICS[number];
export const isModalityTopic = (value: unknown): value is ModalityTopic =>
  typeof value === 'string' && MODALITY_TOPICS.some(topic => topic === value);
