import type { SmartNoteDictionary } from '../smart-note.ts';

/**
 * German — machine-translated clinical words, for native review; the first
 * word of each key is how its chip reads.
 */
export const WORDS: SmartNoteDictionary = {
  complaints: {
    hairFall: ['Haarausfall', 'Haarverlust'],
    itching: ['Juckreiz', 'Jucken'],
    tan: ['Sonnenbräune', 'gebräunt'],
    tanning: ['Bräunung'],
    acne: ['Akne'],
    pimples: ['Pickel'],
    pigmentation: ['Pigmentierung', 'Pigmentstörung'],
    darkSpots: ['Dunkle Flecken', 'dunklen Flecken', 'Altersflecken', 'Pigmentflecken'],
    redness: ['Rötung'],
    dandruff: ['Schuppen'],
    dryness: ['Trockenheit', 'trockene Haut'],
    pain: ['Schmerzen', 'Schmerz'],
  },
  diagnosis: {
    melasma: ['Melasma', 'Chloasma'],
    alopecia: ['Alopezie'],
    pih: ['PIH', 'postinflammatorische Hyperpigmentierung'],
    acneVulgaris: ['Acne vulgaris', 'Akne vulgaris'],
    dermatitis: ['Dermatitis', 'Ekzem'],
    seborrheic: ['Seborrhoisch', 'Seborrhö'],
    fungalInfection: ['Pilzinfektion', 'Hautpilz', 'Mykose'],
    vitiligo: ['Vitiligo', 'Weißfleckenkrankheit'],
  },
  treatmentSuggestions: {
    peel: ['Peeling'],
    lhr: ['Laser-Haarentfernung', 'Laserhaarentfernung'],
    hydrafacial: ['Hydrafacial'],
    prp: ['PRP', 'Eigenbluttherapie'],
    laser: ['Laser', 'Lasertherapie'],
    microneedling: ['Microneedling', 'Mikroneedling'],
  },
};
