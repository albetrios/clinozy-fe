import type { SmartNoteDictionary } from '../smart-note.ts';

/**
 * French — machine-translated clinical words, for native review; the first
 * word of each key is how its chip reads.
 */
export const WORDS: SmartNoteDictionary = {
  complaints: {
    hairFall: ['Chute de cheveux', 'chute des cheveux', 'perte de cheveux'],
    itching: ['Démangeaisons', 'démangeaison', 'prurit'],
    tan: ['Bronzage', 'peau bronzée'],
    tanning: ['Bronzage'],
    acne: ['Acné'],
    pimples: ['Boutons'],
    pigmentation: ['Pigmentation'],
    darkSpots: ['Taches brunes', 'taches pigmentaires', 'taches sombres'],
    redness: ['Rougeurs', 'rougeur'],
    dandruff: ['Pellicules'],
    dryness: ['Sécheresse', 'peau sèche'],
    pain: ['Douleur'],
  },
  diagnosis: {
    melasma: ['Mélasma', 'chloasma'],
    alopecia: ['Alopécie'],
    pih: ['HPI', 'hyperpigmentation post-inflammatoire'],
    acneVulgaris: ['Acné vulgaire'],
    dermatitis: ['Dermatite', 'eczéma'],
    seborrheic: ['Séborrhéique', 'séborrhée'],
    fungalInfection: ['Mycose', 'infection fongique'],
    vitiligo: ['Vitiligo'],
  },
  treatmentSuggestions: {
    peel: ['Peeling'],
    lhr: ['Épilation laser', 'épilation au laser'],
    hydrafacial: ['Hydrafacial'],
    prp: ['PRP', 'plasma riche en plaquettes'],
    laser: ['Laser'],
    microneedling: ['Microneedling', 'microaiguilletage'],
  },
};
