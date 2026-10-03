import { describe, expect, it } from 'vitest';

import i18n from '@/lib/i18n/i18n.ts';
import { DELETE_REASON_VALUES } from '@/shared/api/clinic/clinic-schema.ts';

import { CONFIRM_NS } from './confirm-dialog.constants.ts';
import {
  needsNote,
  REASON_KINDS,
  reasonChipTone,
  STORED_DELETE_REASONS,
  toReasonChoice,
} from './confirm-reasons.ts';

describe('confirm reasons', () => {
  it('declares exactly the contract’s delete_reason values', () => {
    // Declared locally so a confirm never pulls the schema module into its chunk.
    expect([...STORED_DELETE_REASONS]).toEqual([...DELETE_REASON_VALUES]);
  });

  it('keeps a reason the schema has, with the typed note alone', () => {
    expect(
      toReasonChoice({ value: 'duplicate', label: 'Duplicate' }, '  entered twice '),
    ).toEqual({
      reason: 'duplicate',
      note: 'entered twice',
      picked: { value: 'duplicate', label: 'Duplicate' },
      comment: 'entered twice',
    });
    expect(
      toReasonChoice({ value: 'mistake', label: 'Created by mistake' }, '   '),
    ).toMatchObject({ reason: 'mistake', note: null, comment: '' });
  });

  it('stores a reason the schema lacks as "other", its label leading the note', () => {
    expect(toReasonChoice({ value: 'spam', label: 'Spam' }, '')).toMatchObject({
      reason: 'other',
      note: 'Spam',
      comment: '',
    });
    expect(toReasonChoice({ value: 'spam', label: 'Spam' }, 'from a bot')).toMatchObject({
      reason: 'other',
      note: 'Spam · from a bot',
      comment: 'from a bot',
    });
  });

  it('"Other" is the one reason that needs a note', () => {
    expect(needsNote('other')).toBe(true);
    for (const value of ['mistake', 'duplicate', 'not_needed', 'spam']) {
      expect(needsNote(value)).toBe(false);
    }
  });

  it('tones the chips blush · butter · lav, then stone', () => {
    const tone = (index: number) => /bg-tone-(\w+)/.exec(reasonChipTone(index))?.[1];
    expect([0, 1, 2, 3, 4, 9].map(tone)).toEqual([
      'blush',
      'butter',
      'lav',
      'stone',
      'stone',
      'stone',
    ]);
  });

  it.each(Object.entries(REASON_KINDS))(
    '%s: four reasons ending in "Other", every label and line in the locale',
    (_kind, copy) => {
      expect(copy.options).toHaveLength(4);
      expect(copy.options.at(-1)?.value).toBe('other');
      for (const key of [
        copy.actionKey,
        copy.effectKey,
        ...copy.options.map((o) => o.labelKey),
      ]) {
        expect(i18n.exists(key, { ns: CONFIRM_NS }), key).toBe(true);
      }
    },
  );
});
