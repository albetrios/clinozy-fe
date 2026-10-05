import { describe, expect, it } from 'vitest';

import { I18N_LOCALES, type I18nLocale } from '@/lib/i18n/locales.ts';
import ar from '@/locales/ar/patient-file.json';
import de from '@/locales/de/patient-file.json';
import en from '@/locales/en/patient-file.json';
import es from '@/locales/es/patient-file.json';
import fr from '@/locales/fr/patient-file.json';
import hi from '@/locales/hi/patient-file.json';
import italian from '@/locales/it/patient-file.json';
import ja from '@/locales/ja/patient-file.json';
import ko from '@/locales/ko/patient-file.json';
import pt from '@/locales/pt/patient-file.json';
import zh from '@/locales/zh/patient-file.json';

import {
  foldSmartNoteText,
  loadSmartNoteReading,
  parseSmartNote,
  SMART_NOTE_KEYS,
} from './smart-note.ts';

const CATALOG = ['Flubolt 400', 'Clonix-B Lotion', 'Minoxidil 5% Solution'];

/** Each locale's placeholder example (`timeline.clinical.smartExample`). */
const EXAMPLES: Readonly<Record<I18nLocale, string>> = {
  ar: ar.timeline.clinical.smartExample,
  de: de.timeline.clinical.smartExample,
  en: en.timeline.clinical.smartExample,
  es: es.timeline.clinical.smartExample,
  fr: fr.timeline.clinical.smartExample,
  hi: hi.timeline.clinical.smartExample,
  it: italian.timeline.clinical.smartExample,
  ja: ja.timeline.clinical.smartExample,
  ko: ko.timeline.clinical.smartExample,
  pt: pt.timeline.clinical.smartExample,
  zh: zh.timeline.clinical.smartExample,
};

/** The chips a note files under `locale`, as `[field, text]` pairs. */
async function chipsOf(locale: I18nLocale, note: string) {
  const { chips } = parseSmartNote(note, [], await loadSmartNoteReading(locale));
  return chips.map(({ field, text }) => [field, text]);
}

describe('parseSmartNote (H:4917)', () => {
  it('files the words it knows under their lists, as the dictionary writes them', async () => {
    const reading = await loadSmartNoteReading('en');
    expect(reading.english).toBeUndefined();
    expect(parseSmartNote('hair fall 2 months, suggest PRP', CATALOG, reading)).toEqual({
      chips: [
        { field: 'complaints', text: 'Hair fall' },
        { field: 'treatmentSuggestions', text: 'PRP' },
      ],
      medicines: [],
    });
  });

  it('reads any case — a diagnosis too', async () => {
    expect(await chipsOf('en', 'MELASMA on both cheeks')).toEqual([
      ['diagnosis', 'Melasma'],
    ]);
  });

  it('names each medicine of the catalogue whose first word the note holds', async () => {
    const reading = await loadSmartNoteReading('en');
    expect(
      parseSmartNote('start flubolt and clonix-b at night', [...CATALOG, ' '], reading)
        .medicines,
    ).toEqual(['Flubolt 400', 'Clonix-B Lotion']);
  });

  it('reads nothing under three letters — two in a script without spaces', async () => {
    const english = await loadSmartNoteReading('en');
    expect(parseSmartNote(' ta ', CATALOG, english)).toEqual({
      chips: [],
      medicines: [],
    });
    expect(await chipsOf('zh', '脱发')).toEqual([['complaints', '脱发']]);
    expect(await chipsOf('ko', '탈모')).toEqual([['complaints', '탈모']]);
  });

  it('keeps a short word to itself: "important" is no tan, "tan" is', async () => {
    expect(await chipsOf('en', 'important: constant itching')).toEqual([
      ['complaints', 'Itching'],
    ]);
    expect(await chipsOf('en', 'tan on both arms')).toEqual([['complaints', 'Tan']]);
    expect(await chipsOf('en', 'hyperpigmentation since spring')).toEqual([
      ['complaints', 'Pigmentation'],
    ]);
  });

  it('never files under Later (H:4918)', () => {
    expect(Object.keys(SMART_NOTE_KEYS)).toEqual([
      'complaints',
      'diagnosis',
      'treatmentSuggestions',
    ]);
  });
});

describe('the smart note in every language (L-64)', () => {
  it.each(I18N_LOCALES)(
    '%s: the placeholder’s example reads as it says',
    async (locale) => {
      const chips = await chipsOf(locale, EXAMPLES[locale]);
      expect(chips.map(([field]) => field)).toEqual([
        'complaints',
        'treatmentSuggestions',
      ]);
      expect(chips[1]).toEqual(['treatmentSuggestions', 'PRP']);
    },
  );

  it.each(I18N_LOCALES)('%s: names every key, each with words', async (locale) => {
    const { own } = await loadSmartNoteReading(locale);
    for (const [field, keys] of Object.entries(SMART_NOTE_KEYS)) {
      const words = own[field as keyof typeof SMART_NOTE_KEYS] as Record<
        string,
        readonly string[]
      >;
      expect(Object.keys(words)).toEqual([...keys]);
      for (const key of keys) expect(words[key]?.[0]?.trim()).toBeTruthy();
    }
  });

  it.each(I18N_LOCALES)('%s: still reads English', async (locale) => {
    const chips = await chipsOf(locale, 'hair fall, melasma');
    expect(chips.map(([field]) => field)).toEqual(['complaints', 'diagnosis']);
  });

  it('en: Hair fall, Itching and PRP', async () => {
    expect(await chipsOf('en', 'Itching scalp, hair fall — PRP next week')).toEqual([
      ['complaints', 'Hair fall'],
      ['complaints', 'Itching'],
      ['treatmentSuggestions', 'PRP'],
    ]);
  });

  it('de: German words, umlauts or not, and English beside them', async () => {
    expect(
      await chipsOf(
        'de',
        'Akne und Juckreiz, V. a. seborrhoische Dermatitis, Peeling empfohlen',
      ),
    ).toEqual([
      ['complaints', 'Juckreiz'],
      ['complaints', 'Akne'],
      ['diagnosis', 'Dermatitis'],
      ['diagnosis', 'Seborrhoisch'],
      ['treatmentSuggestions', 'Peeling'],
    ]);
    expect(await chipsOf('de', 'ROTUNG an den Wangen, trockene Haut')).toEqual([
      ['complaints', 'Rötung'],
      ['complaints', 'Trockenheit'],
    ]);
    expect(await chipsOf('de', 'acne seit Jahren')).toEqual([['complaints', 'Acne']]);
  });

  it('hi: Hindi words, a left-out nukta, and a short word kept to itself', async () => {
    expect(await chipsOf('hi', 'चेहरे पर मुंहासे और खुजली, केमिकल पील की सलाह')).toEqual([
      ['complaints', 'खुजली'],
      ['complaints', 'मुंहासे'],
      ['treatmentSuggestions', 'पील'],
    ]);
    expect(await chipsOf('hi', 'बाल झडना जारी')).toEqual([['complaints', 'बाल झड़ना']]);
    expect(await chipsOf('hi', 'वह बहुत हमदर्द हैं')).toEqual([]);
    expect(await chipsOf('hi', 'सिर में दर्द')).toEqual([['complaints', 'दर्द']]);
  });

  it('ja: found anywhere, a Latin term before a particle too', async () => {
    expect(await chipsOf('ja', '頬に肝斑とシミ、ピーリングを提案')).toEqual([
      ['complaints', 'シミ'],
      ['diagnosis', '肝斑'],
      ['treatmentSuggestions', 'ピーリング'],
    ]);
    expect(await chipsOf('ja', 'ＰＲＰを提案')).toEqual([
      ['treatmentSuggestions', 'PRP'],
    ]);
  });

  it('ar: Arabic words with their article, marks and hamza folded', async () => {
    expect(
      await chipsOf('ar', 'حكة شديدة وقشرة في فروة الرأس، التهاب الجلد الزهمي'),
    ).toEqual([
      ['complaints', 'حكة'],
      ['complaints', 'قشرة'],
      ['diagnosis', 'التهاب الجلد'],
      ['diagnosis', 'زهمي'],
    ]);
    expect(await chipsOf('ar', 'المريض يشكو من الم في الوجه')).toEqual([
      ['complaints', 'ألم'],
    ]);
    expect(await chipsOf('ar', 'المريض بخير')).toEqual([]);
    expect(await chipsOf('ar', 'يُنصح بالليزر')).toEqual([
      ['treatmentSuggestions', 'ليزر'],
    ]);
  });

  it('es: English "tan" is not read — it is Spanish for "so"', async () => {
    expect(await chipsOf('es', 'no es tan grave, picor leve')).toEqual([
      ['complaints', 'Picazón'],
    ]);
  });

  it('zh and ko: their own words, found inside longer ones', async () => {
    expect(await chipsOf('zh', '面部黄褐斑，建议激光')).toEqual([
      ['diagnosis', '黄褐斑'],
      ['treatmentSuggestions', '激光'],
    ]);
    expect(await chipsOf('ko', '여드름이 심하고 가려움, 필링 권유')).toEqual([
      ['complaints', '가려움'],
      ['complaints', '여드름'],
      ['treatmentSuggestions', '필링'],
    ]);
  });
});

describe('foldSmartNoteText', () => {
  it('folds case, accents, full-width forms, Arabic marks and the nukta', () => {
    expect(foldSmartNoteText('Démangeaisons  RÖTUNG ＰＲＰ Straße')).toBe(
      'demangeaisons rotung prp strasse',
    );
    expect(foldSmartNoteText('أَلَم إكزيما حكّة')).toBe('الم اكزيما حكه');
    expect(foldSmartNoteText('झड़ना')).toBe(foldSmartNoteText('झडना'));
  });
});
