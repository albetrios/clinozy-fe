import type { SmartNoteDictionary } from '../smart-note.ts';

/**
 * Korean — machine-translated clinical words, for native review; the first
 * word of each key is how its chip reads. Found anywhere in the note, so a
 * particle after the word ("탈모가") still reads.
 */
export const WORDS: SmartNoteDictionary = {
  complaints: {
    hairFall: ['탈모', '머리 빠짐', '머리카락 빠짐'],
    itching: ['가려움', '가려워', '가렵', '소양감'],
    tan: ['선탠', '그을림'],
    tanning: ['태닝'],
    acne: ['여드름'],
    pimples: ['뾰루지', '트러블'],
    pigmentation: ['색소침착'],
    darkSpots: ['잡티', '검은 반점'],
    redness: ['홍조', '붉은기', '발적'],
    dandruff: ['비듬'],
    dryness: ['건조함', '건조'],
    pain: ['통증', '아픔'],
  },
  diagnosis: {
    melasma: ['기미', '간반'],
    alopecia: ['탈모증', '원형 탈모'],
    pih: ['염증 후 색소침착', 'PIH'],
    acneVulgaris: ['보통 여드름', '심상성 여드름'],
    dermatitis: ['피부염', '습진'],
    seborrheic: ['지루성'],
    fungalInfection: ['진균 감염', '곰팡이 감염', '무좀'],
    vitiligo: ['백반증'],
  },
  treatmentSuggestions: {
    peel: ['필링', '박피'],
    lhr: ['레이저 제모', '레이저제모'],
    hydrafacial: ['하이드라페이셜'],
    prp: ['PRP', '자가혈 치료'],
    laser: ['레이저'],
    microneedling: ['마이크로니들링', 'MTS'],
  },
};
