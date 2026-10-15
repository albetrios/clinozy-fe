import { describe, expect, it } from 'vitest';

import { contactValueOfDraft } from './use-quick-add-contact.ts';

describe('contactValueOfDraft — a quick add as the contact editor holds it', () => {
  it('splits the name, prefixes the mobile and keeps the handle as the one Instagram', () => {
    const value = contactValueOfDraft({
      name: 'Meera Iyer',
      phone: '9825011241',
      instagram: '@meera.iyer',
    });
    expect(value.firstName).toBe('Meera');
    expect(value.lastName).toBe('Iyer');
    expect(value.phones).toEqual([{ digits: '9825011241', whatsapp: true }]);
    expect(value.instagram).toEqual(['@meera.iyer']);
  });

  it('keeps part of a number for "More details" to finish, and no handle when none was typed', () => {
    const value = contactValueOfDraft({ name: 'Meera', phone: '98250', instagram: '' });
    expect(value.phones[0]?.digits).toBe('98250');
    expect(value.instagram).toEqual([]);
  });
});
