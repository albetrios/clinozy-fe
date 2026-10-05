import type { SmartNoteDictionary } from '../smart-note.ts';

/**
 * Italian — machine-translated clinical words, for native review; the first
 * word of each key is how its chip reads.
 */
export const WORDS: SmartNoteDictionary = {
  complaints: {
    hairFall: ['Caduta dei capelli', 'caduta di capelli', 'perdita di capelli'],
    itching: ['Prurito'],
    tan: ['Abbronzatura'],
    tanning: ['Abbronzatura'],
    acne: ['Acne'],
    pimples: ['Brufoli', 'brufolo'],
    pigmentation: ['Pigmentazione'],
    darkSpots: ['Macchie scure', 'macchie brune'],
    redness: ['Arrossamento', 'rossore'],
    dandruff: ['Forfora'],
    dryness: ['Secchezza', 'pelle secca'],
    pain: ['Dolore'],
  },
  diagnosis: {
    melasma: ['Melasma', 'cloasma'],
    alopecia: ['Alopecia'],
    pih: ['PIH', 'iperpigmentazione post-infiammatoria'],
    acneVulgaris: ['Acne volgare'],
    dermatitis: ['Dermatite', 'eczema'],
    seborrheic: ['Seborroica', 'seborroico', 'seborrea'],
    fungalInfection: ['Infezione fungina', 'micosi'],
    vitiligo: ['Vitiligine'],
  },
  treatmentSuggestions: {
    peel: ['Peeling'],
    lhr: ['Epilazione laser', 'epilazione al laser'],
    hydrafacial: ['Hydrafacial'],
    prp: ['PRP', 'plasma ricco di piastrine'],
    laser: ['Laser'],
    microneedling: ['Microneedling'],
  },
};
