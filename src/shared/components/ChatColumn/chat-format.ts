import type { TFunction } from 'i18next';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import i18n from '@/lib/i18n/i18n.ts';
import { dateFormatOptions, resolvedTimeZone } from '@/lib/i18n/intl-config.ts';
import { ensureNamespace } from '@/lib/i18n/load-namespace.ts';
import {
  CLINIC_TIME_ZONE,
  clinicClockTime,
  clinicToday,
  localDateOf,
} from '@/shared/api/clinic/clinic-time.ts';
import type { ChatPerson } from '@/shared/api/clinic/messages-contracts.ts';
import { basePrice } from '@/shared/api/clinic/offerings-pricing.ts';
import type { AuthUser } from '@/shared/auth/types.ts';
import { shortPersonName } from '@/shared/components/Cells/PersonAvatar/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { useOfferings } from '@/shared/hooks/useOfferings/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import { useTemplateValues } from '@/shared/hooks/useThread/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';

import {
  CHAT_COLUMN_KEYS,
  CHAT_COLUMN_NS,
  MESSAGE_LANGUAGE,
} from './chat-column.constants.ts';
import {
  type ChatContact,
  type ChatSender,
  fillValues,
  firstNameOf,
  interestPhrase,
  type MessageContext,
  offeringFor,
  type VisitSummary,
} from './chat-composer.ts';
import type { ChatClock, ChatFormat } from './chat-history.ts';

/**
 * The chat's clock (`useLocaleFormat`): days are the clinic's — or the
 * viewer's chosen zone — and times follow the viewer's format and hour cycle.
 */
function useChatClock(): ChatClock {
  const { formatDate, prefs } = useLocaleFormat();
  return useMemo(() => {
    const zone = resolvedTimeZone(prefs.timeZone) ?? CLINIC_TIME_ZONE;
    const today = clinicToday(new Date(), zone);
    const clockOptions: Intl.DateTimeFormatOptions = {
      ...dateFormatOptions('time', prefs.hourCycle),
      hour: 'numeric',
      second: undefined,
      timeZone: zone,
    };
    return {
      today,
      dayOf: (instant) => clinicToday(new Date(instant), zone),
      time: (instant) => formatDate(instant, clockOptions),
      shortTime: (instant) =>
        formatDate(
          instant,
          clinicClockTime(new Date(instant), zone).endsWith(':00')
            ? { ...clockOptions, minute: undefined }
            : clockOptions,
        ),
      date: (date) =>
        formatDate(
          localDateOf(date),
          {
            day: 'numeric',
            month: 'short',
            ...(date.slice(0, 4) === today.slice(0, 4) ? {} : { year: 'numeric' }),
          },
          { civilDay: true },
        ),
    };
  }, [formatDate, prefs]);
}

/** Everything the thread's strings need, in the screen's language. */
export function useChatFormat(maskMoney: boolean): ChatFormat {
  const { t } = useTranslation(CHAT_COLUMN_NS);
  const money = usePaiseFormat();
  const clock = useChatClock();
  return useMemo(() => ({ t, money, clock, maskMoney }), [t, money, clock, maskMoney]);
}

/**
 * The patient-message translator (Q-X2: messages are English at launch, the
 * screen may not be): loads the message language's `clinic` copy when the
 * screen runs in another language.
 */
function useMessageTranslator(): TFunction {
  const [ready, setReady] = useState(() =>
    i18n.hasResourceBundle(MESSAGE_LANGUAGE, CHAT_COLUMN_NS),
  );
  useEffect(() => {
    if (ready) return;
    let live = true;
    void ensureNamespace(MESSAGE_LANGUAGE, CHAT_COLUMN_NS).then(() => {
      if (live) setReady(true);
    });
    return () => {
      live = false;
    };
  }, [ready]);
  // The translator reads the store when called, so the re-render `ready` causes
  // is all a late bundle needs.
  const { t } = useTranslation(CHAT_COLUMN_NS, { lng: MESSAGE_LANGUAGE });
  return t;
}

/** The signed-in member as messages name them ("Riya", "Riya S."). */
function senderOf(user: AuthUser | null): ChatSender {
  const name = user?.name?.trim() || user?.email.split('@')[0] || '';
  return { first: firstNameOf(name), short: name ? shortPersonName(name) : '' };
}

/**
 * What a person's starters, smart chips and templates put in a message, and
 * the "Fill in" values: the clinic's name, branch address and links and free
 * slots (`useTemplateValues`), the offering their interest names
 * (`useOfferings`), the signed-in member, their next visit.
 */
export function useMessageContext({
  person,
  contact,
  clock,
  upcoming,
}: {
  person: ChatPerson;
  contact: ChatContact;
  clock: ChatClock;
  upcoming: VisitSummary['upcoming'];
}): { ctx: MessageContext; fill: Record<string, string> } {
  const tm = useMessageTranslator();
  const values = useTemplateValues(person).data;
  const offerings = useOfferings().data;
  const user = useAuthStore((state) => state.user);
  const money = usePaiseFormat();
  return useMemo(() => {
    const interest = interestPhrase(contact.interests, tm);
    const offering = offeringFor(offerings ?? [], interest);
    const ctx: MessageContext = {
      tm,
      clock,
      first: firstNameOf(contact.name) || tm(CHAT_COLUMN_KEYS.content.there),
      me: senderOf(user),
      clinic: values?.clinicName ?? '',
      mapsLink: values?.mapsLink ?? '',
      offering: offering
        ? {
            name: offering.name,
            price: money(basePrice(offering)),
            sessions: offering.sessions,
          }
        : null,
      interest,
      freeSlots: values?.freeSlots ?? [],
      upcoming,
    };
    const fill = fillValues(ctx, {
      address: values?.address ?? '',
      reviewLink: values?.reviewLink ?? '',
    });
    return { ctx, fill };
  }, [contact, tm, values, offerings, user, money, clock, upcoming]);
}
