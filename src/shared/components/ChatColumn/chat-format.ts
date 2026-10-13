import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { ChatPerson } from '@/shared/api/app/messages-contracts.ts';
import { basePrice } from '@/shared/api/app/offerings-pricing.ts';
import type { AuthUser } from '@/shared/auth/types.ts';
import { shortPersonName } from '@/shared/components/Cells/PersonAvatar/index.ts';
import { useAppClock } from '@/shared/hooks/useAppClock/index.ts';
import { useMessageTranslator } from '@/shared/hooks/useMessageTranslator/index.ts';
import { useOfferings } from '@/shared/hooks/useOfferings/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';
import { useTemplateValues } from '@/shared/hooks/useThread/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';

import { CHAT_COLUMN_KEYS, CHAT_COLUMN_NS } from './chat-column.constants.ts';
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

/** Everything the thread's strings need, in the screen's language. */
export function useChatFormat(maskMoney: boolean): ChatFormat {
  const { t } = useTranslation(CHAT_COLUMN_NS);
  const money = usePaiseFormat();
  const clock = useAppClock();
  return useMemo(() => ({ t, money, clock, maskMoney }), [t, money, clock, maskMoney]);
}

/** The signed-in member as messages name them ("Riya", "Riya S."). */
function senderOf(user: AuthUser | null): ChatSender {
  const name = user?.name?.trim() || (user?.email.split('@')[0] ?? ''); // NOSONAR(S6606): a blank name ("") falls back to the email's local part
  return { first: firstNameOf(name), short: name ? shortPersonName(name) : '' };
}

/**
 * What a person's starters, smart chips and templates put in a message, and
 * the "Fill in" values: the clinic's name, branch address and links and free
 * slots (`useTemplateValues`), the offering their interest names and what it bills before any
 * offer, in clinozy-be's rupees (`useOfferings`), the signed-in member, their next visit.
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
  const tm = useMessageTranslator(CHAT_COLUMN_NS);
  const values = useTemplateValues(person).data;
  const offerings = useOfferings().data;
  const user = useAuthStore((state) => state.user);
  const rupees = useRupeeFormat();
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
            price: rupees(basePrice(offering)),
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
  }, [contact, tm, values, offerings, user, rupees, clock, upcoming]);
}
