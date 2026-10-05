import type { SmartNoteDictionary } from '../smart-note.ts';

/**
 * Chinese (Simplified) — machine-translated clinical words, for native
 * review; the first word of each key is how its chip reads. Found anywhere
 * in the note (no spaces between words).
 */
export const WORDS: SmartNoteDictionary = {
  complaints: {
    hairFall: ['脱发', '掉发', '掉头发'],
    itching: ['瘙痒', '痒'],
    tan: ['晒黑'],
    tanning: ['美黑'],
    acne: ['痤疮', '粉刺', '青春痘'],
    pimples: ['痘痘', '长痘'],
    pigmentation: ['色素沉着', '色沉'],
    darkSpots: ['色斑', '黑斑'],
    redness: ['发红', '泛红', '红斑'],
    dandruff: ['头皮屑', '头屑'],
    dryness: ['干燥'],
    pain: ['疼痛', '痛'],
  },
  diagnosis: {
    melasma: ['黄褐斑'],
    alopecia: ['脱发症', '斑秃', '秃发'],
    pih: ['炎症后色素沉着', 'PIH'],
    acneVulgaris: ['寻常痤疮', '寻常性痤疮'],
    dermatitis: ['皮炎', '湿疹'],
    seborrheic: ['脂溢性'],
    fungalInfection: ['真菌感染', '癣'],
    vitiligo: ['白癜风'],
  },
  treatmentSuggestions: {
    peel: ['化学换肤', '换肤', '刷酸'],
    lhr: ['激光脱毛'],
    hydrafacial: ['海菲秀', '小气泡'],
    prp: ['PRP', '富血小板血浆'],
    laser: ['激光'],
    microneedling: ['微针'],
  },
};
