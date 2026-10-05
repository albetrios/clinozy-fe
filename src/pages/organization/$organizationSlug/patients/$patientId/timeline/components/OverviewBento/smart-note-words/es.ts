import type { SmartNoteDictionary } from '../smart-note.ts';

/**
 * Spanish — machine-translated clinical words, for native review; the first
 * word of each key is how its chip reads. "tan" is everyday Spanish ("so"),
 * so the English "tan" is not read here.
 */
export const WORDS: SmartNoteDictionary = {
  complaints: {
    hairFall: [
      'Caída del cabello',
      'caída de cabello',
      'caída del pelo',
      'pérdida de cabello',
    ],
    itching: ['Picazón', 'comezón', 'prurito', 'picor'],
    tan: ['Bronceado', 'bronceada'],
    tanning: ['Bronceamiento'],
    acne: ['Acné'],
    pimples: ['Granos', 'espinillas'],
    pigmentation: ['Pigmentación'],
    darkSpots: ['Manchas oscuras'],
    redness: ['Enrojecimiento', 'rojez'],
    dandruff: ['Caspa'],
    dryness: ['Sequedad', 'piel seca'],
    pain: ['Dolor'],
  },
  diagnosis: {
    melasma: ['Melasma', 'cloasma'],
    alopecia: ['Alopecia'],
    pih: ['HPI', 'hiperpigmentación postinflamatoria'],
    acneVulgaris: ['Acné vulgar'],
    dermatitis: ['Dermatitis', 'eccema'],
    seborrheic: ['Seborreica', 'seborreico', 'seborrea'],
    fungalInfection: ['Infección por hongos', 'infección fúngica', 'micosis'],
    vitiligo: ['Vitíligo'],
  },
  treatmentSuggestions: {
    peel: ['Peeling', 'exfoliación química'],
    lhr: ['Depilación láser', 'depilación con láser'],
    hydrafacial: ['Hydrafacial'],
    prp: ['PRP', 'plasma rico en plaquetas'],
    laser: ['Láser'],
    microneedling: ['Microneedling', 'microagujas'],
  },
  ignoreEnglish: ['tan'],
};
