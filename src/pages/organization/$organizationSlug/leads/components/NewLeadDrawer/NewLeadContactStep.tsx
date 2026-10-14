import type { Ref } from 'react';
import { useTranslation } from 'react-i18next';

import { isolateValues } from '@/lib/bidi-isolate.ts';
import { cn } from '@/lib/utils.ts';
import { displayId } from '@/shared/api/app/app-display-id.ts';
import type { ContactSummary } from '@/shared/api/app/contacts-contracts.ts';
import { formatAppPhone } from '@/shared/app/app-phone.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import {
  ContactQuickPick,
  type QuickAddDraft,
} from '@/shared/components/ContactQuickPick/index.ts';

import { LEADS_KEYS, LEADS_NS, LEADS_TEST_IDS } from '../../leads.constants.ts';
import { NEW_LEAD_PRESETS, type NewLeadPreset } from './new-lead-form.ts';

const K = LEADS_KEYS.newLead;

/** Props of {@link NewLeadContactStep}. */
export interface NewLeadContactStepProps {
  /** Takes focus when the drawer opens (`leads.md:150`). */
  searchRef: Ref<HTMLInputElement>;
  /** Which Quick start chip the form's values match. */
  pressed: (preset: NewLeadPreset) => boolean;
  onPreset: (preset: NewLeadPreset) => void;
  /** A person picked: the lead will be theirs. */
  onPick: (hit: ContactSummary) => void;
  /** A person with an open lead already: "Open lead" goes to it (one open lead each, L6). */
  onOpenLead: (leadId: string) => void;
  /** The quick add's name and mobile: the new person the lead is made with. */
  onQuickAdd: (draft: QuickAddDraft) => void;
  /** "More details": the contact editor, from the quick add's values. */
  onMoreDetails: (draft: QuickAddDraft) => void;
}

/**
 * A hit's second line: "Patient · C-12345 · +91 98250 11241", "Open lead · …" or
 * "C-12345 · +91 98250 11241" — the id and the phone isolated, so each stays whole
 * on a right-to-left page. The design's last visit is not on the person (route map §4).
 */
function useHitLine() {
  const { t } = useTranslation(LEADS_NS);
  return (hit: ContactSummary) => {
    const values = isolateValues({
      id: displayId.contact(hit.contactNumber),
      phone: formatAppPhone(hit.primaryPhone),
    });
    if (hit.openLeadId) return t(K.hits.openLead, values);
    return t(hit.patientId ? K.hits.patient : K.hits.contact, values);
  };
}

/** A hit's action: "Open lead" while they have one, "Re-create lead" for a patient, else "Use contact". */
function hitActionKey(hit: ContactSummary): string {
  if (hit.openLeadId) return K.hits.open;
  return hit.patientId ? K.hits.recreate : K.hits.useContact;
}

/** The Quick start chips (H:6159): each sets the lead's source, never the steps. */
function QuickStart({
  pressed,
  onPreset,
}: Pick<NewLeadContactStepProps, 'pressed' | 'onPreset'>) {
  const { t } = useTranslation(LEADS_NS);
  return (
    <fieldset
      aria-label={t(K.quickStart)}
      className="flex min-w-0 flex-wrap items-center gap-1.5 border-0 px-3 pt-2 pb-1"
    >
      <span className="text-caption text-muted-foreground">{t(K.quickStart)}</span>
      {NEW_LEAD_PRESETS.map((preset) => {
        const on = pressed(preset);
        return (
          <button
            key={preset.id}
            type="button"
            aria-pressed={on}
            title={t(K.presetHints[preset.id])}
            onClick={() => onPreset(preset)}
            data-testid={`${LEADS_TEST_IDS.newLeadPreset}-${preset.id}`}
            data-slot="pill"
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap',
              on
                ? cn('bg-muted border-transparent', TONE_CLASSES.stone.selected)
                : 'bg-card hover:bg-muted',
            )}
          >
            <preset.icon aria-hidden="true" className="text-muted-foreground size-3.25" />
            {t(K.presets[preset.id])}
          </button>
        );
      })}
    </fieldset>
  );
}

/**
 * New lead's Contact step (H:1890–1895) on the shared contact picker
 * (change-contact-quick-pick): the 44px search — Recent before typing, then from 3 letters or
 * 4 digits, eight people at most, the typed words marked, ↑ ↓ ↵ — the Quick start chips, the
 * hits ("Open lead" for someone with one, "Re-create lead" for a patient, "Use contact" for
 * anyone else) and the add row, whose quick add takes a name and a 10-digit mobile ("More
 * details" opens the contact editor).
 */
export function NewLeadContactStep({
  searchRef,
  pressed,
  onPreset,
  onPick,
  onOpenLead,
  onQuickAdd,
  onMoreDetails,
}: NewLeadContactStepProps) {
  const { t } = useTranslation(LEADS_NS);
  const hitLine = useHitLine();
  return (
    <ContactQuickPick
      inputRef={searchRef}
      searchPlaceholder={t(K.search)}
      searchLabel={t(K.searchAria)}
      describe={(hit) => ({
        line: hitLine(hit),
        action: t(hitActionKey(hit)),
        tone: hit.patientId ? 'sage' : 'lav',
      })}
      onPick={(hit) => {
        if (hit.openLeadId) onOpenLead(hit.openLeadId);
        else onPick(hit);
      }}
      onQuickAdd={onQuickAdd}
      onMoreDetails={onMoreDetails}
      requirePhone
      toolbar={<QuickStart pressed={pressed} onPreset={onPreset} />}
      testId={LEADS_TEST_IDS.newLeadContact}
      testIds={{
        search: LEADS_TEST_IDS.newLeadSearch,
        hit: (hit) => `${LEADS_TEST_IDS.newLeadHit}-${hit.contactNumber}`,
        add: LEADS_TEST_IDS.newLeadNewContact,
        noMatch: LEADS_TEST_IDS.newLeadNoMatch,
      }}
    />
  );
}
