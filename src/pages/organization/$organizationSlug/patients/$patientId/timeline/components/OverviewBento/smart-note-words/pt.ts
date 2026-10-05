import type { SmartNoteDictionary } from '../smart-note.ts';

/**
 * Portuguese — machine-translated clinical words, for native review; the
 * first word of each key is how its chip reads.
 */
export const WORDS: SmartNoteDictionary = {
  complaints: {
    hairFall: ['Queda de cabelo', 'queda capilar', 'perda de cabelo'],
    itching: ['Coceira', 'prurido', 'comichão'],
    tan: ['Bronzeado'],
    tanning: ['Bronzeamento'],
    acne: ['Acne'],
    pimples: ['Espinhas', 'espinha', 'borbulha'],
    pigmentation: ['Pigmentação'],
    darkSpots: ['Manchas escuras'],
    redness: ['Vermelhidão'],
    dandruff: ['Caspa'],
    dryness: ['Ressecamento', 'secura', 'pele seca'],
    pain: ['Dor'],
  },
  diagnosis: {
    melasma: ['Melasma', 'cloasma'],
    alopecia: ['Alopecia'],
    pih: ['HPI', 'hiperpigmentação pós-inflamatória'],
    acneVulgaris: ['Acne vulgar'],
    dermatitis: ['Dermatite', 'eczema'],
    seborrheic: ['Seborreica', 'seborreico', 'seborreia'],
    fungalInfection: ['Micose', 'infecção fúngica'],
    vitiligo: ['Vitiligo'],
  },
  treatmentSuggestions: {
    peel: ['Peeling'],
    lhr: ['Depilação a laser', 'depilação laser'],
    hydrafacial: ['Hydrafacial'],
    prp: ['PRP', 'plasma rico em plaquetas'],
    laser: ['Laser'],
    microneedling: ['Microagulhamento', 'microneedling'],
  },
};
