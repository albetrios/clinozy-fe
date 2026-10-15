import { describe, expect, it } from 'vitest';

import { appendPhrase, inputMethodOf } from './bug-report-text.ts';

describe('bug-report-text', () => {
  it('joins a dictated phrase with one space and caps the length', () => {
    expect(appendPhrase('', 'It froze')).toBe('It froze');
    expect(appendPhrase('The total  ', 'is wrong')).toBe('The total is wrong');
    expect(appendPhrase('a'.repeat(4999), 'bc')).toHaveLength(5000);
  });

  it('names how the report was written', () => {
    expect(inputMethodOf({ usedVoice: false, typed: true })).toBe('typed');
    expect(inputMethodOf({ usedVoice: false, typed: false })).toBe('typed');
    expect(inputMethodOf({ usedVoice: true, typed: false })).toBe('voice');
    expect(inputMethodOf({ usedVoice: true, typed: true })).toBe('mixed');
  });
});
