import type { SmartNoteDictionary } from '../smart-note.ts';

/**
 * Hindi — machine-translated clinical words, for native review; the first
 * word of each key is how its chip reads. A nukta may be left out ("झडना").
 */
export const WORDS: SmartNoteDictionary = {
  complaints: {
    hairFall: ['बाल झड़ना', 'बाल झड़', 'बालों का झड़', 'बाल गिर'],
    itching: ['खुजली', 'खुजलाहट'],
    tan: ['टैन', 'सनटैन'],
    tanning: ['टैनिंग'],
    acne: ['मुंहासे', 'मुँहासे', 'मुंहासों'],
    pimples: ['फुंसी', 'फुंसियां', 'दाने'],
    pigmentation: ['पिगमेंटेशन', 'रंजकता'],
    darkSpots: ['काले धब्बे', 'काले दाग', 'दाग-धब्बे'],
    redness: ['लालिमा', 'लाली', 'लाल चकत्ते'],
    dandruff: ['रूसी', 'डैंड्रफ'],
    dryness: ['रूखापन', 'सूखापन'],
    pain: ['दर्द'],
  },
  diagnosis: {
    melasma: ['मेलाज्मा', 'झाइयां', 'झाईं'],
    alopecia: ['एलोपेसिया', 'गंजापन'],
    pih: ['PIH', 'सूजन के बाद हाइपरपिगमेंटेशन'],
    acneVulgaris: ['एक्ने वल्गेरिस'],
    dermatitis: ['डर्मेटाइटिस', 'त्वचाशोथ', 'एक्जिमा'],
    seborrheic: ['सेबोरिक', 'सेबोरहाइक'],
    fungalInfection: ['फंगल संक्रमण', 'फंगल इन्फेक्शन', 'दाद'],
    vitiligo: ['सफेद दाग', 'विटिलिगो', 'श्वित्र'],
  },
  treatmentSuggestions: {
    peel: ['पील', 'केमिकल पील'],
    lhr: ['लेज़र हेयर रिमूवल'],
    hydrafacial: ['हाइड्राफेशियल'],
    prp: ['PRP', 'पीआरपी'],
    laser: ['लेज़र'],
    microneedling: ['माइक्रोनीडलिंग'],
  },
};
