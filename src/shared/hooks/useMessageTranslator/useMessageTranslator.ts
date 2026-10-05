import type { TFunction } from 'i18next';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import i18n from '@/lib/i18n/i18n.ts';
import { ensureNamespace } from '@/lib/i18n/load-namespace.ts';
import type { I18nLocale } from '@/lib/i18n/locales.ts';
import type { I18nNamespace } from '@/lib/i18n/namespaces.ts';

/**
 * The language a patient message is written in: English at launch (Q-X2),
 * whatever the screen's language — the chat's starters, templates and
 * fill-ins and Medical's payment reminders are what the patient reads.
 */
export const MESSAGE_LANGUAGE: I18nLocale = 'en';

/**
 * The patient-message translator (Q-X2: messages are English at launch, the
 * screen may not be) for one namespace: loads the message language's copy of
 * it when the screen runs in another language.
 */
export function useMessageTranslator(ns: I18nNamespace): TFunction {
  const [ready, setReady] = useState(() => i18n.hasResourceBundle(MESSAGE_LANGUAGE, ns));
  useEffect(() => {
    if (ready) return;
    let live = true;
    void ensureNamespace(MESSAGE_LANGUAGE, ns).then(() => {
      if (live) setReady(true);
    });
    return () => {
      live = false;
    };
  }, [ns, ready]);
  // The translator reads the store when called, so the re-render `ready` causes
  // is all a late bundle needs.
  const { t } = useTranslation(ns, { lng: MESSAGE_LANGUAGE });
  return t;
}
