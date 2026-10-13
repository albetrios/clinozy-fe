import type { SmartNoteDictionary } from '../smart-note.ts';

/**
 * Arabic — machine-translated clinical words, for native review; the first
 * word of each key is how its chip reads. Vowel marks, hamza seats, ى and ة
 * fold, so "الم" reads as "ألم"; short words stand alone ("ألم", not
 * "المريض"), so each also comes with its article ("الألم").
 */
export const WORDS: SmartNoteDictionary = {
  complaints: {
    hairFall: ['تساقط الشعر', 'سقوط الشعر'],
    itching: ['حكة', 'الحكة', 'هرش'],
    tan: ['سمرة', 'اسمرار'],
    tanning: ['تسمير'],
    acne: ['حب الشباب'],
    pimples: ['بثور'],
    pigmentation: ['تصبغ'],
    darkSpots: ['بقع داكنة', 'بقع سوداء', 'بقع غامقة'],
    redness: ['احمرار'],
    dandruff: ['قشرة'],
    dryness: ['جفاف'],
    pain: ['ألم', 'الألم', 'وجع'],
  },
  diagnosis: {
    melasma: ['كلف', 'ميلازما'],
    alopecia: ['ثعلبة', 'صلع'],
    pih: ['PIH', 'فرط التصبغ التالي للالتهاب'],
    acneVulgaris: ['حب الشباب الشائع'],
    dermatitis: ['التهاب الجلد', 'إكزيما'],
    seborrheic: ['زهمي', 'التهاب الجلد الدهني'],
    fungalInfection: ['عدوى فطرية', 'فطري'],
    vitiligo: ['بهاق'],
  },
  treatmentSuggestions: {
    peel: ['تقشير'],
    lhr: ['إزالة الشعر بالليزر', 'ليزر إزالة الشعر'],
    hydrafacial: ['هيدرافيشل', 'هايدرافيشل'],
    prp: ['PRP', 'بلازما'],
    laser: ['ليزر'],
    microneedling: ['الإبر الدقيقة', 'ميكرونيدلينغ'],
  },
};
