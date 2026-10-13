import type { SmartNoteDictionary } from '../smart-note.ts';

/**
 * Japanese — machine-translated clinical words, for native review; the first
 * word of each key is how its chip reads. Found anywhere in the note (no
 * spaces between words). 脱毛 alone is left out: it also means hair removal.
 */
export const WORDS: SmartNoteDictionary = {
  complaints: {
    hairFall: ['抜け毛', '薄毛', '髪が抜ける'],
    itching: ['かゆみ', 'かゆい', '痒'],
    tan: ['日焼け', '日やけ'],
    tanning: ['タンニング', '日焼けサロン'],
    acne: ['ニキビ', 'にきび', '痤瘡'],
    pimples: ['吹き出物', 'できもの'],
    pigmentation: ['色素沈着'],
    darkSpots: ['シミ', '黒ずみ', '色素斑'],
    redness: ['赤み', '発赤'],
    dandruff: ['フケ', 'ふけ'],
    dryness: ['乾燥', 'かさつき'],
    pain: ['痛み', '痛'],
  },
  diagnosis: {
    melasma: ['肝斑', 'かんぱん'],
    alopecia: ['脱毛症', 'AGA'],
    pih: ['炎症後色素沈着', 'PIH'],
    acneVulgaris: ['尋常性痤瘡', '尋常性ざ瘡'],
    dermatitis: ['皮膚炎', '湿疹'],
    seborrheic: ['脂漏性'],
    fungalInfection: ['真菌感染', '白癬', '水虫'],
    vitiligo: ['白斑', '尋常性白斑'],
  },
  treatmentSuggestions: {
    peel: ['ピーリング'],
    lhr: ['レーザー脱毛', '医療脱毛'],
    hydrafacial: ['ハイドラフェイシャル'],
    prp: ['PRP', '多血小板血漿'],
    laser: ['レーザー'],
    microneedling: ['マイクロニードリング', 'ダーマペン'],
  },
};
