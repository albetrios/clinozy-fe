import { describe, expect, it } from 'vitest';

import {
  CONTACT_PREFERENCE_MAX,
  contactFieldsOf,
  contactValueOf,
  emptyContactValue,
  extraReachCount,
  isPresetPreference,
  primaryPhoneOf,
  withCustomPreference,
  withPrimaryPhone,
} from './contact-editor-value.ts';

describe('contact editor values', () => {
  it('starts a new contact on WhatsApp, with the prefilled name and mobile', () => {
    expect(emptyContactValue('Rhea Shah', '+919825011241')).toEqual({
      name: 'Rhea Shah',
      phones: [{ digits: '9825011241', whatsapp: true }],
      instagram: [],
      defaultChannel: 'whatsapp',
      preferences: [],
    });
    expect(emptyContactValue().phones).toEqual([{ digits: '', whatsapp: true }]);
  });

  it('reads a record’s contact fields, or its own mobile when nobody set them', () => {
    expect(contactValueOf({ name: 'Alpa', phone: '+919825011241' })).toEqual(
      emptyContactValue('Alpa', '+919825011241'),
    );
    expect(
      contactValueOf({
        name: 'Rhea Shah',
        phone: '+919825011241',
        contact: {
          phones: [
            { phone: '+919825011241', whatsapp: true },
            { phone: '+919099055120', whatsapp: false },
          ],
          instagram: ['@rhea'],
          defaultChannel: 'instagram',
          preferences: ['No calls'],
        },
      }),
    ).toEqual({
      name: 'Rhea Shah',
      phones: [
        { digits: '9825011241', whatsapp: true },
        { digits: '9099055120', whatsapp: false },
      ],
      instagram: ['@rhea'],
      defaultChannel: 'instagram',
      preferences: ['No calls'],
    });
  });

  it('moves a number first to make it the primary', () => {
    const phones = [
      { digits: '9825011241', whatsapp: true },
      { digits: '9099055120', whatsapp: false },
    ];
    expect(withPrimaryPhone(phones, 1)).toEqual([phones[1], phones[0]]);
    expect(withPrimaryPhone(phones, 0)).toEqual(phones);
    expect(withPrimaryPhone(phones, 5)).toEqual(phones);
  });

  it('adds a custom preference trimmed to 40, ignoring duplicates case aside', () => {
    expect(withCustomPreference(['No calls'], '  Call after lunch ')).toEqual([
      'No calls',
      'Call after lunch',
    ]);
    expect(withCustomPreference(['No calls'], 'no CALLS')).toEqual(['No calls']);
    expect(withCustomPreference([], '   ')).toEqual([]);
    expect(withCustomPreference([], 'x'.repeat(50))[0]).toHaveLength(
      CONTACT_PREFERENCE_MAX,
    );
  });

  it('knows the presets from the custom ones', () => {
    expect(isPresetPreference('After 6 pm')).toBe(true);
    expect(isPresetPreference('Call after lunch')).toBe(false);
  });

  it('counts the reach beyond the primary for " · +N more"', () => {
    const value = {
      ...emptyContactValue('Rhea', '+919825011241'),
      phones: [
        { digits: '9825011241', whatsapp: true },
        { digits: '9099055120', whatsapp: true },
        { digits: '', whatsapp: true },
      ],
      instagram: ['@rhea', ' '],
    };
    expect(extraReachCount(value)).toBe(2);
    expect(extraReachCount(emptyContactValue('Rhea', '+919825011241'))).toBe(0);
  });

  it('stores the trimmed name, the primary in E.164 and only complete numbers', () => {
    const value = {
      name: '  Rhea Shah ',
      phones: [
        { digits: '9825011241', whatsapp: true },
        { digits: '90990', whatsapp: false },
      ],
      instagram: [' @rhea ', ''],
      defaultChannel: 'sms' as const,
      preferences: ['No calls'],
    };
    expect(primaryPhoneOf(value)).toBe('+919825011241');
    expect(contactFieldsOf(value)).toEqual({
      name: 'Rhea Shah',
      phone: '+919825011241',
      contact: {
        phones: [{ phone: '+919825011241', whatsapp: true }],
        instagram: ['@rhea'],
        defaultChannel: 'sms',
        preferences: ['No calls'],
      },
    });
    expect(
      primaryPhoneOf({ ...value, phones: [{ digits: '98250', whatsapp: true }] }),
    ).toBeNull();
  });
});
