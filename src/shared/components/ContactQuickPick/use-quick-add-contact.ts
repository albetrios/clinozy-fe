import { useTranslation } from 'react-i18next';

import { isolateValues } from '@/lib/bidi-isolate.ts';
import { findContactByPhone } from '@/shared/api/app/contacts-api.ts';
import type { ContactSummary } from '@/shared/api/app/contacts-contracts.ts';
import { toAppPhone } from '@/shared/app/app-phone.ts';
import { notifyError } from '@/shared/errors/errorHandler.ts';
import {
  type ContactEditorValue,
  contactFieldsOf,
  emptyContactValue,
} from '@/shared/forms/ContactEditor/index.ts';
import { useCreateContact } from '@/shared/hooks/useContacts/index.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  CONTACT_QUICK_PICK_KEYS,
  CONTACT_QUICK_PICK_NS,
} from './contact-quick-pick.constants.ts';
import type { QuickAddDraft } from './contact-quick-pick-query.ts';

const K = CONTACT_QUICK_PICK_KEYS;

/**
 * A quick add's values as the contact editor holds them (change-natural-contact-search D4): the
 * name split, the mobile +91, the handle as its one Instagram — New lead's new person and the
 * contact a quick add makes.
 */
export function contactValueOfDraft({
  name,
  phone,
  instagram,
}: QuickAddDraft): ContactEditorValue {
  return {
    // The local digits as typed — a part of a number stays a part, for "More details" to finish.
    ...emptyContactValue(name, phone || null),
    instagram: instagram ? [instagram] : [],
  };
}

/**
 * Whoever the clinic has on a quick add's mobile (E.164; none without one) — the duplicate check
 * before anything is made. A failed read says why and rejects.
 */
export async function findQuickAddMobile(
  mobile: string | null,
): Promise<Awaited<ReturnType<typeof findContactByPhone>>> {
  if (!mobile) return null;
  try {
    return await findContactByPhone(mobile);
  } catch (error) {
    notifyError(error);
    throw error;
  }
}

/**
 * A quick add that makes the contact at once (change-contact-quick-pick D24) — for a field whose
 * save takes a contact's id, not a new person (New task's "For"). The mobile is looked up first
 * (`GET /app/contacts?phone=`): someone on it already is handed back ("… is already a contact ·
 * picked"), else the contact is made (`POST /app/contacts`, "… added to contacts") with the
 * name, mobile and handle typed. A failure
 * says why and rejects, so the quick add stays open with what was typed.
 */
export function useQuickAddContact(): (draft: QuickAddDraft) => Promise<ContactSummary> {
  const { t } = useTranslation(CONTACT_QUICK_PICK_NS);
  const create = useCreateContact();
  return async (draft) => {
    const known = await findQuickAddMobile(toAppPhone(draft.phone));
    if (known) {
      notify.info(t(K.existing, isolateValues({ name: known.name })));
      return known;
    }
    const contact = await create.mutateAsync(contactFieldsOf(contactValueOfDraft(draft)));
    notify.success(t(K.added, isolateValues({ name: contact.name })));
    return contact;
  };
}
