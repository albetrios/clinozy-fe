import { describe, expect, it } from 'vitest';

import { isolateJoin, isolateText, isolateValues } from './bidi-isolate.ts';

const FSI = '\u2068';
const LRI = '\u2066';
const PDI = '\u2069';

describe('isolateText — one data token in its own direction', () => {
  it('wraps free text in FSI…PDI (the string form of dir="auto")', () => {
    expect(isolateText('Riya S.')).toBe(`${FSI}Riya S.${PDI}`);
  });

  it('wraps a phone or an id in LRI…PDI when asked (dir="ltr")', () => {
    expect(isolateText('+91 98250 44120', 'ltr')).toBe(`${LRI}+91 98250 44120${PDI}`);
  });

  it('keeps empty text empty', () => {
    expect(isolateText('')).toBe('');
  });

  it('keeps the characters and their order — only invisible marks are added', () => {
    const token = 'INV-787';
    expect(isolateText(token).replace(/[\u2066-\u2069]/g, '')).toBe(token);
  });
});

describe('isolateValues — the tokens of a translated sentence', () => {
  it('isolates string values and leaves numbers and i18next options alone', () => {
    expect(
      isolateValues({ name: 'Riya Shah', count: 2, ns: 'clinic', context: 'male' }),
    ).toEqual({ name: `${FSI}Riya Shah${PDI}`, count: 2, ns: 'clinic', context: 'male' });
  });

  it('isolates each token, not the sentence around it', () => {
    const values = isolateValues({ id: '#3508', phone: '+91 98250 44120' });
    const line = `${values.id} · ${values.phone}`;
    expect(line).toBe(`${FSI}#3508${PDI} · ${FSI}+91 98250 44120${PDI}`);
  });
});

describe('isolateJoin — the design’s " · " join', () => {
  it('isolates every part and drops the empty ones', () => {
    expect(isolateJoin(['#3508', '', null, undefined, false, '+91 98250 44120'])).toBe(
      `${FSI}#3508${PDI} · ${FSI}+91 98250 44120${PDI}`,
    );
  });

  it('takes another separator and returns empty text for no parts', () => {
    expect(isolateJoin(['Adajan', 'Vesu'], ', ')).toBe(
      `${FSI}Adajan${PDI}, ${FSI}Vesu${PDI}`,
    );
    expect(isolateJoin([null, ''])).toBe('');
  });
});
