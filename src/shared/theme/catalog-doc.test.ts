import { describe, expect, it } from 'vitest';

import { THEME_DOC_ASSERTIONS } from './catalog-doc.ts';
import { THEME_ID } from './presets.ts';

describe('catalog-doc', () => {
  it('asks every theming doc to name the one look', () => {
    for (const [doc, assertions] of Object.entries(THEME_DOC_ASSERTIONS)) {
      expect(
        assertions.some((assertion) => assertion.mustInclude.includes(THEME_ID)),
        doc,
      ).toBe(true);
    }
  });

  it('keeps the retired studio out of each of them', () => {
    for (const [doc, assertions] of Object.entries(THEME_DOC_ASSERTIONS)) {
      const excluded = assertions.flatMap((assertion) => assertion.mustExclude ?? []);
      expect(excluded, doc).toEqual(expect.arrayContaining(['?theme=', 'shuffleTheme']));
    }
  });
});
