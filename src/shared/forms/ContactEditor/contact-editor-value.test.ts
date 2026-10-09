import { describe, expect, it } from 'vitest';

import type { Contact } from '@/shared/api/clinic/contacts-contracts.ts';

import {
  type ContactEditorValue,
  contactFieldsOf,
  contactValueName,
  contactValueOf,
  customPreferenceLabel,
  emptyContactValue,
  extraReachCount,
  isPresetPreference,
  primaryPhoneOf,
  withCustomPreference,
  withPrimaryPhone,
} from './contact-editor-value.ts';

/** Rhea as `GET /app/contacts/:contact_id` reads her — her primary number second on the wire. */
const RHEA: Contact = {
  id: 'con_rhea00000000000000000',
  contactNumber: 12345,
  firstName: 'Rhea',
  lastName: 'Shah',
  name: 'Rhea Shah',
  primaryPhone: '+919825011241',
  email: null,
  instagramHandles: ['@rhea', '@rhea.skin'],
  defaultChannel: 'instagram',
  preferenceTags: ['no_calls', 'prefers_saturdays'],
  patientId: null,
  openLeadId: null,
  lastActivityAt: null,
  lastReceivedAt: null,
  isAwaitingReply: false,
  updatedAt: '2026-10-03T05:00:00.000Z',
  phones: [
    { phone: '+919099055120', isPrimary: false, isOnWhatsapp: false },
    { phone: '+919825011241', isPrimary: true, isOnWhatsapp: true },
  ],
};

/** A value with its fields overridden. */
function valueWith(fields: Partial<ContactEditorValue>): ContactEditorValue {
  return { ...emptyContactValue('Rhea Shah', '+919825011241'), ...fields };
}

describe('a new contact', () => {
  it('starts on WhatsApp, the prefilled name split into its first word and the rest', () => {
    expect(emptyContactValue('Rhea Shah', '+919825011241')).toEqual({
      firstName: 'Rhea',
      lastName: 'Shah',
      phones: [{ digits: '9825011241', whatsapp: true }],
      instagram: [],
      defaultChannel: 'whatsapp',
      preferences: [],
    });
    expect(emptyContactValue('  Rhea   Kiran Shah ')).toMatchObject({
      firstName: 'Rhea',
      lastName: 'Kiran Shah',
    });
    expect(emptyContactValue('Rhea')).toMatchObject({ firstName: 'Rhea', lastName: '' });
  });

  it('starts blank, with one empty number on WhatsApp', () => {
    expect(emptyContactValue()).toMatchObject({
      firstName: '',
      lastName: '',
      phones: [{ digits: '', whatsapp: true }],
    });
  });
});

describe('a contact read from the API', () => {
  it('starts from its fields, the primary number first', () => {
    expect(contactValueOf(RHEA)).toEqual({
      firstName: 'Rhea',
      lastName: 'Shah',
      phones: [
        { digits: '9825011241', whatsapp: true },
        { digits: '9099055120', whatsapp: false },
      ],
      instagram: ['@rhea', '@rhea.skin'],
      defaultChannel: 'instagram',
      preferences: ['no_calls', 'prefers_saturdays'],
    });
  });

  it('reads a missing last name as empty', () => {
    expect(contactValueOf({ ...RHEA, lastName: null }).lastName).toBe('');
  });

  it('copies the lists, so an edit never reaches the read', () => {
    const value = contactValueOf(RHEA);
    value.instagram.push('@new');
    value.preferences.push('hindi');
    expect(RHEA.instagramHandles).toEqual(['@rhea', '@rhea.skin']);
    expect(RHEA.preferenceTags).toEqual(['no_calls', 'prefers_saturdays']);
  });
});

describe('the name', () => {
  it('joins the trimmed first and last names, or shows the first alone', () => {
    expect(contactValueName(valueWith({ firstName: ' Riya ', lastName: ' Shah ' }))).toBe(
      'Riya Shah',
    );
    expect(contactValueName(valueWith({ firstName: 'Riya', lastName: '  ' }))).toBe(
      'Riya',
    );
    expect(contactValueName(valueWith({ firstName: '', lastName: '' }))).toBe('');
  });
});

describe('the numbers', () => {
  const phones = [
    { digits: '9825011241', whatsapp: true },
    { digits: '9099055120', whatsapp: false },
  ];

  it('moves a number first to make it the primary', () => {
    expect(withPrimaryPhone(phones, 1)).toEqual([phones[1], phones[0]]);
    expect(withPrimaryPhone(phones, 0)).toEqual(phones);
    expect(withPrimaryPhone(phones, 5)).toEqual(phones);
  });

  it('stores the primary in E.164 — none until it is a 10-digit mobile', () => {
    expect(primaryPhoneOf(valueWith({ phones }))).toBe('+919825011241');
    expect(
      primaryPhoneOf(valueWith({ phones: [{ digits: '98250', whatsapp: true }] })),
    ).toBeNull();
  });

  it('counts the reach beyond the primary for " · +N more"', () => {
    const value = valueWith({
      phones: [...phones, { digits: '', whatsapp: true }],
      instagram: ['@rhea', ' '],
    });
    expect(extraReachCount(value)).toBe(2);
    expect(extraReachCount(emptyContactValue('Rhea', '+919825011241'))).toBe(0);
  });
});

describe('the preferences', () => {
  it('knows the presets by their tags', () => {
    expect(isPresetPreference('no_calls')).toBe(true);
    expect(isPresetPreference('after_six_pm')).toBe(true);
    expect(isPresetPreference('prefers_saturdays')).toBe(false);
    // A label is not a tag.
    expect(isPresetPreference('No calls')).toBe(false);
  });

  it('shows a custom tag with spaces', () => {
    expect(customPreferenceLabel('prefers_saturdays')).toBe('prefers saturdays');
  });

  it('turns typed words into a lowercase tag, `_` between them, a letter first', () => {
    expect(withCustomPreference(['no_calls'], '  Prefers Saturdays! ')).toEqual([
      'no_calls',
      'prefers_saturdays',
    ]);
    expect(withCustomPreference([], '2 pm only')).toEqual(['pm_only']);
    expect(withCustomPreference([], 'Call after 5')).toEqual(['call_after_5']);
    // Typed words that name a preset add the preset's tag.
    expect(withCustomPreference([], 'No calls')).toEqual(['no_calls']);
  });

  it('keeps the typed words to 40 characters', () => {
    const [tag] = withCustomPreference([], 'x'.repeat(50));
    expect(tag).toHaveLength(40);
  });

  it('adds nothing blank, too short, already there or past the twelfth', () => {
    expect(withCustomPreference([], '   ')).toEqual([]);
    expect(withCustomPreference([], 'x')).toEqual([]);
    expect(withCustomPreference([], '42')).toEqual([]);
    expect(withCustomPreference(['prefers_saturdays'], 'PREFERS saturdays')).toEqual([
      'prefers_saturdays',
    ]);
    const twelve = Array.from({ length: 12 }, (_, at) => `tag_${'a'.repeat(at + 1)}`);
    expect(withCustomPreference(twelve, 'one more')).toEqual(twelve);
  });

  it('hands back a new list, never the one it was given', () => {
    const preferences = ['no_calls'];
    expect(withCustomPreference(preferences, '')).not.toBe(preferences);
  });
});

describe('what the editor writes', () => {
  it('trims the names, and sends an empty last name as none', () => {
    expect(
      contactFieldsOf(valueWith({ firstName: '  Rhea ', lastName: ' Shah  ' })),
    ).toMatchObject({ firstName: 'Rhea', lastName: 'Shah' });
    expect(contactFieldsOf(valueWith({ lastName: '   ' })).lastName).toBeNull();
  });

  it('writes only the complete numbers, the primary first, with their WhatsApp marks', () => {
    const fields = contactFieldsOf(
      valueWith({
        phones: [
          { digits: '9825011241', whatsapp: true },
          { digits: '90990', whatsapp: true },
          { digits: '9099055120', whatsapp: false },
        ],
        instagram: [' @rhea ', ''],
        defaultChannel: 'call',
        preferences: ['no_calls', 'prefers_saturdays'],
      }),
    );
    expect(fields).toEqual({
      firstName: 'Rhea',
      lastName: 'Shah',
      phones: [
        { phone: '+919825011241', isOnWhatsapp: true },
        { phone: '+919099055120', isOnWhatsapp: false },
      ],
      instagramHandles: ['@rhea'],
      defaultChannel: 'call',
      preferenceTags: ['no_calls', 'prefers_saturdays'],
    });
  });

  it('keeps at most five numbers, five handles and twelve tags', () => {
    const fields = contactFieldsOf(
      valueWith({
        phones: Array.from({ length: 6 }, (_, at) => ({
          digits: `98250112${String(at).padStart(2, '0')}`,
          whatsapp: true,
        })),
        instagram: Array.from({ length: 6 }, (_, at) => `@rhea.${at}`),
        preferences: Array.from({ length: 13 }, (_, at) => `tag_${'a'.repeat(at + 1)}`),
      }),
    );
    expect(fields.phones).toHaveLength(5);
    expect(fields.phones[0]).toEqual({ phone: '+919825011200', isOnWhatsapp: true });
    expect(fields.instagramHandles).toEqual([
      '@rhea.0',
      '@rhea.1',
      '@rhea.2',
      '@rhea.3',
      '@rhea.4',
    ]);
    expect(fields.preferenceTags).toHaveLength(12);
  });
});
