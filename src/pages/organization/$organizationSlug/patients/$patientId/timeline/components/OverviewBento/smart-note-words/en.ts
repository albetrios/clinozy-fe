import type { SmartNoteDictionary } from '../smart-note.ts';

/**
 * English — the prototype's dictionary verbatim (H:3702 `SN_DICT`), one word
 * per key; read under every language too, since clinicians often type English.
 */
export const WORDS: SmartNoteDictionary = {
  complaints: {
    hairFall: ['Hair fall'],
    itching: ['Itching'],
    tan: ['Tan'],
    tanning: ['Tanning'],
    acne: ['Acne'],
    pimples: ['Pimples'],
    pigmentation: ['Pigmentation'],
    darkSpots: ['Dark spots'],
    redness: ['Redness'],
    dandruff: ['Dandruff'],
    dryness: ['Dryness'],
    pain: ['Pain'],
  },
  diagnosis: {
    melasma: ['Melasma'],
    alopecia: ['Alopecia'],
    pih: ['PIH'],
    acneVulgaris: ['Acne vulgaris'],
    dermatitis: ['Dermatitis'],
    seborrheic: ['Seborrheic'],
    fungalInfection: ['Fungal infection'],
    vitiligo: ['Vitiligo'],
  },
  treatmentSuggestions: {
    peel: ['Peel'],
    lhr: ['LHR'],
    hydrafacial: ['Hydrafacial'],
    prp: ['PRP'],
    laser: ['Laser'],
    microneedling: ['Microneedling'],
  },
};
