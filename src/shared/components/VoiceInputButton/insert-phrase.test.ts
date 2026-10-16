import { describe, expect, it } from 'vitest';

import { insertPhrase } from './insert-phrase.ts';

describe('insertPhrase', () => {
  it('starts an empty field with a capital', () => {
    expect(insertPhrase({ value: '', phrase: 'pigmentation on both cheeks' })).toEqual({
      value: 'Pigmentation on both cheeks',
      caret: 27,
    });
  });

  it('joins at the end with one space, mid-sentence in lower case', () => {
    expect(insertPhrase({ value: 'Mild redness', phrase: 'after the peel' }).value).toBe(
      'Mild redness after the peel',
    );
    expect(insertPhrase({ value: 'Mild redness ', phrase: 'after' }).value).toBe(
      'Mild redness after',
    );
  });

  it('capitalises after the end of a sentence or a line break', () => {
    expect(
      insertPhrase({ value: 'Healed well.', phrase: 'continue sunscreen' }).value,
    ).toBe('Healed well. Continue sunscreen');
    expect(insertPhrase({ value: 'Line one\n', phrase: 'line two' }).value).toBe(
      'Line one\nLine two',
    );
    expect(insertPhrase({ value: 'हो गया।', phrase: 'ठीक है' }).value).toBe(
      'हो गया। ठीक है',
    );
  });

  it('writes at the caret, spacing both sides, and replaces a selection', () => {
    const value = 'Apply twice daily';
    const inserted = insertPhrase({ value, phrase: 'gently', start: 6, end: 6 });
    expect(inserted.value).toBe('Apply gently twice daily');
    expect(inserted.caret).toBe(13);
    expect(
      insertPhrase({ value: 'Apply twice daily', phrase: 'once', start: 6, end: 11 })
        .value,
    ).toBe('Apply once daily');
  });

  it('adds no space before punctuation that follows', () => {
    expect(insertPhrase({ value: 'Use it.', phrase: 'daily', start: 6 }).value).toBe(
      'Use it daily.',
    );
  });

  it('cuts the phrase, never the text already there, at the limit', () => {
    const inserted = insertPhrase({ value: 'abcd', phrase: 'efgh', maxLength: 7 });
    expect(inserted.value).toBe('abcd ef');
    expect(inserted.caret).toBe(7);
    expect(insertPhrase({ value: 'abcd', phrase: 'x', maxLength: 4 }).value).toBe('abcd');
  });

  it('writes a spoken mark or line break straight after the words before it', () => {
    expect(insertPhrase({ value: 'Mild redness ', phrase: '. avoid sun' }).value).toBe(
      'Mild redness. avoid sun',
    );
    expect(insertPhrase({ value: 'Mild redness', phrase: ',' }).value).toBe(
      'Mild redness,',
    );
    expect(insertPhrase({ value: '原因', phrase: '。' }).value).toBe('原因。');
    const broken = insertPhrase({ value: 'Day one plan', phrase: '\n', start: 7 });
    expect(broken.value).toBe('Day one\nplan');
    expect(broken.caret).toBe(8);
  });

  it('leaves the text alone for an empty phrase', () => {
    expect(insertPhrase({ value: 'Kept', phrase: '   ' })).toEqual({
      value: 'Kept',
      caret: 4,
    });
  });
});
