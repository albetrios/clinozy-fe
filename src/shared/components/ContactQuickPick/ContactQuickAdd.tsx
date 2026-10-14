import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ContactScope } from '@/shared/api/app/contacts-api.ts';
import {
  DrawerField,
  DrawerInput,
  DrawerPhoneInput,
} from '@/shared/components/DrawerField/index.ts';
import { Spinner } from '@/shared/components/Spinner/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { ChevronLeft, UserPlus } from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  CONTACT_QUICK_PICK_ADD_KEYS,
  CONTACT_QUICK_PICK_KEYS,
  CONTACT_QUICK_PICK_NS,
  CONTACT_QUICK_PICK_TEST_IDS,
} from './contact-quick-pick.constants.ts';
import { QUICK_ADD_NAME_MAX, type QuickAddDraft } from './contact-quick-pick-query.ts';

const K = CONTACT_QUICK_PICK_KEYS.quickAdd;
const IDS = CONTACT_QUICK_PICK_TEST_IDS;

/** Props for {@link ContactQuickAdd}. */
export interface ContactQuickAddProps {
  /** What the search held — the fields start from it. */
  draft: QuickAddDraft;
  /** A new contact (default) or a new patient — the title's and the button's words. */
  scope?: ContactScope;
  /** "Add contact" also needs a 10-digit mobile (New lead: the lead cannot be made without one). */
  requirePhone: boolean;
  /** The checked values; a promise holds the button busy until it settles. */
  onAdd: (draft: QuickAddDraft) => void | Promise<void>;
  /** "More details": the full contact editor, from these values. */
  onMoreDetails?: (draft: QuickAddDraft) => void;
  /** "Back to search" — the search keeps what was typed. */
  onBack: () => void;
  testId: string;
}

/**
 * The contact picker's inline quick add (change-contact-quick-pick D8): Name and Mobile (+91)
 * prefilled from the search, the focus on the first empty one; ↵ in either field adds. "Add
 * contact" checks a name ("Add a name") and the mobile — ten digits when one is required ("Add
 * a 10-digit mobile"), or when one is typed ("Mobile needs 10 digits"). While the host's add is
 * on its way (a patient being registered) the button spins and a second press waits; a failed
 * add leaves the fields as they are.
 */
export function ContactQuickAdd({
  draft,
  scope = 'everyone',
  requirePhone,
  onAdd,
  onMoreDetails,
  onBack,
  testId,
}: ContactQuickAddProps) {
  const { t } = useTranslation(CONTACT_QUICK_PICK_NS);
  const words = CONTACT_QUICK_PICK_ADD_KEYS[scope];
  const id = useId();
  const [name, setName] = useState(draft.name);
  const [phone, setPhone] = useState(draft.phone);
  const [adding, setAdding] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  // The first empty field takes the focus: the search filled the other.
  useEffect(() => {
    (draft.name ? phoneRef : nameRef).current?.focus();
  }, [draft.name]);

  const values = (): QuickAddDraft => ({
    name: name.trim().slice(0, QUICK_ADD_NAME_MAX),
    phone,
  });
  const valid = (): boolean => {
    if (!name.trim()) {
      notify.warning(t(K.addName));
      nameRef.current?.focus();
      return false;
    }
    const message = requirePhone ? K.needMobile : K.mobileDigits;
    if ((requirePhone || phone) && phone.length !== 10) {
      notify.warning(t(message));
      phoneRef.current?.focus();
      return false;
    }
    return true;
  };

  return (
    <form
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        if (adding || !valid()) return;
        setAdding(true);
        try {
          await onAdd(values());
        } catch {
          // The host said why; the fields stay for another try.
        } finally {
          setAdding(false);
        }
      }}
      aria-labelledby={`${id}-title`}
      data-testid={IDS.quickAdd(testId)}
      className="animate-reveal @container flex flex-col gap-3 p-3"
    >
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={t(K.back)}
          title={t(K.back)}
          onClick={onBack}
          data-testid={IDS.quickAddBack(testId)}
          className="text-muted-foreground -ms-1"
        >
          <ChevronLeft aria-hidden="true" className="rtl:rotate-180" />
        </Button>
        <span id={`${id}-title`} className="text-body font-semibold">
          {t(words.newPerson)}
        </span>
        {onMoreDetails ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => onMoreDetails(values())}
            data-testid={IDS.quickAddMore(testId)}
            className="text-foreground-soft ms-auto"
          >
            {t(K.more)}
          </Button>
        ) : null}
      </div>
      {/* Name · Mobile · Add in one row, stacked in a narrow drawer — the who editor's grid. */}
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(150px,190px)_auto] items-end gap-2 @max-[480px]:grid-cols-1">
        <DrawerField label={t(K.name)} htmlFor={`${id}-name`}>
          <DrawerInput
            ref={nameRef}
            id={`${id}-name`}
            value={name}
            maxLength={QUICK_ADD_NAME_MAX}
            autoComplete="off"
            placeholder={t(K.namePlaceholder)}
            onChange={(event) => setName(event.currentTarget.value)}
            data-testid={IDS.quickAddName(testId)}
          />
        </DrawerField>
        <DrawerField label={t(K.mobile)} htmlFor={`${id}-mobile`}>
          <DrawerPhoneInput
            ref={phoneRef}
            id={`${id}-mobile`}
            value={phone}
            onChange={setPhone}
            data-testid={IDS.quickAddMobile(testId)}
          />
        </DrawerField>
        <Button
          type="submit"
          aria-busy={adding || undefined}
          data-testid={IDS.quickAddSubmit(testId)}
        >
          {adding ? <Spinner /> : <UserPlus aria-hidden="true" />}
          {t(words.submit)}
        </Button>
      </div>
    </form>
  );
}
