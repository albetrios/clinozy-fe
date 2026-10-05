import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import i18n from '@/lib/i18n/i18n.ts';
import { ensureNamespace } from '@/lib/i18n/load-namespace.ts';
import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

import { MESSAGE_LANGUAGE, useMessageTranslator } from './useMessageTranslator.ts';

const NS = I18N_NAMESPACES.medical;
const KEY = 'drawers.reminders.message';
const VALUES = { name: 'Rhea', clinic: 'Cresence Skin', amount: '₹563' };
const ENGLISH =
  'Hi Rhea, this is a reminder from Cresence Skin that ₹563 is due for your medicines. Reply here if you have any questions. Thank you!';

afterEach(async () => {
  await i18n.changeLanguage('en');
  await ensureNamespace(MESSAGE_LANGUAGE, NS);
});

describe('useMessageTranslator (Q-X2)', () => {
  it('writes a patient message in English whatever the screen speaks', async () => {
    expect(MESSAGE_LANGUAGE).toBe('en');
    await ensureNamespace('de', NS);
    await i18n.changeLanguage('de');
    const { result } = renderHook(() => useMessageTranslator(NS));
    await waitFor(() => expect(result.current(KEY, VALUES)).toBe(ENGLISH));
    // The screen itself stays German.
    expect(i18n.t(`${NS}:drawers.reminders.title`)).toBe('Zahlungserinnerungen');
  });

  it('loads the message language’s copy when it is not there yet', async () => {
    i18n.removeResourceBundle(MESSAGE_LANGUAGE, NS);
    await ensureNamespace('de', NS);
    await i18n.changeLanguage('de');
    const { result } = renderHook(() => useMessageTranslator(NS));
    await waitFor(() => expect(result.current(KEY, VALUES)).toBe(ENGLISH));
  });
});
