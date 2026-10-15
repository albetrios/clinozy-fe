import { describe, expect, it } from 'vitest';

import { readSpokenPhrase, type VoiceVocabulary } from './voice-commands.ts';

/** The English commands, as `app` › `voice.say` / `voice.marks` hold them. */
const ENGLISH: VoiceVocabulary = {
  marks: [
    { mark: 'period', words: ['full stop', 'period'], text: '.' },
    { mark: 'comma', words: ['comma'], text: ',' },
    { mark: 'question', words: ['question mark'], text: '?' },
    { mark: 'newLine', words: ['new line', 'next line'], text: '\n' },
    { mark: 'newParagraph', words: ['new paragraph'], text: '\n\n' },
  ],
  scratch: ['scratch that', 'delete that'],
};

const read = (phrase: string, multiline = true) =>
  readSpokenPhrase({ phrase, vocabulary: ENGLISH, multiline });

describe('readSpokenPhrase — marks said as words', () => {
  it('writes the mark against the word before and starts the next sentence', () => {
    expect(read('mild redness full stop avoid sun comma both cheeks')).toEqual({
      text: 'mild redness. Avoid sun, both cheeks',
      undo: 0,
    });
    expect(read('is it worse Question Mark')).toEqual({ text: 'is it worse?', undo: 0 });
  });

  it('breaks the line in a note, and lets a single line ignore it', () => {
    expect(read('day one new line day two').text).toBe('day one\nDay two');
    expect(read('plan new paragraph review').text).toBe('plan\n\nReview');
    expect(read('day one new line day two', false).text).toBe('day one day two');
  });

  it('writes a mark said on its own, for the field to glue to the words before', () => {
    expect(read('full stop').text).toBe('.');
    expect(read('new line').text).toBe('\n');
  });

  it('hears whole words only', () => {
    expect(read('two commas and a periodic review').text).toBe(
      'two commas and a periodic review',
    );
  });

  it('keeps the phrase as it is with no commands to hear', () => {
    expect(
      readSpokenPhrase({
        phrase: ' plain words ',
        vocabulary: { marks: [], scratch: [] },
        multiline: true,
      }),
    ).toEqual({ text: 'plain words', undo: 0 });
  });
});

describe('readSpokenPhrase — "scratch that"', () => {
  it('on its own takes back the phrase before, once per time it is said', () => {
    expect(read('scratch that')).toEqual({ text: '', undo: 1 });
    expect(read('delete that scratch that')).toEqual({ text: '', undo: 2 });
  });

  it('after words drops those words and keeps what follows', () => {
    expect(read('twice daily scratch that once a day')).toEqual({
      text: 'once a day',
      undo: 0,
    });
  });
});

describe('readSpokenPhrase — other scripts', () => {
  it('finds a Chinese command inside words with no spaces, and adds no space after its mark', () => {
    const chinese: VoiceVocabulary = {
      marks: [{ mark: 'period', words: ['句号'], text: '。' }],
      scratch: [],
    };
    expect(
      readSpokenPhrase({
        phrase: '双颊色斑句号避免日晒',
        vocabulary: chinese,
        multiline: true,
      }).text,
    ).toBe('双颊色斑。避免日晒');
  });

  it('writes the danda for Hindi and does not hear a command inside a longer word', () => {
    const hindi: VoiceVocabulary = {
      marks: [{ mark: 'period', words: ['पूर्ण विराम'], text: '।' }],
      scratch: ['इसे हटाओ'],
    };
    expect(
      readSpokenPhrase({
        phrase: 'धूप से बचें पूर्ण विराम क्रीम लगाएँ',
        vocabulary: hindi,
        multiline: true,
      }).text,
    ).toBe('धूप से बचें। क्रीम लगाएँ');
    expect(
      readSpokenPhrase({ phrase: 'अपूर्ण विराम', vocabulary: hindi, multiline: true })
        .text,
    ).toBe('अपूर्ण विराम');
  });
});
