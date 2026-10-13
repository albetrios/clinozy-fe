import type { Ref } from 'react';
import { useTranslation } from 'react-i18next';

import { isolateValues } from '@/lib/bidi-isolate.ts';
import { cn } from '@/lib/utils.ts';
import { displayId } from '@/shared/api/app/app-display-id.ts';
import type { ContactSummary } from '@/shared/api/app/contacts-contracts.ts';
import { formatAppPhone } from '@/shared/app/app-phone.ts';
import { PersonAvatar, personInitials } from '@/shared/components/Cells/index.ts';
import {
  CONTACT_EDITOR_KEYS,
  CONTACT_EDITOR_NS,
} from '@/shared/forms/ContactEditor/index.ts';
import { Plus, Search } from '@/shared/icons/index.ts';

import { LEADS_KEYS, LEADS_NS, LEADS_TEST_IDS } from '../../leads.constants.ts';
import { NEW_LEAD_PRESETS, type NewLeadPreset } from './new-lead-form.ts';

const K = LEADS_KEYS.newLead;

/** Props of {@link NewLeadContactStep}. */
export interface NewLeadContactStepProps {
  query: string;
  onQueryChange: (query: string) => void;
  /** Takes focus when the drawer opens (`leads.md:150`). */
  searchRef: Ref<HTMLInputElement>;
  hits: readonly ContactSummary[];
  noMatch: boolean;
  /** Which Quick start chip the form's values match. */
  pressed: (preset: NewLeadPreset) => boolean;
  onPreset: (preset: NewLeadPreset) => void;
  /** A person picked: the lead will be theirs. */
  onPick: (hit: ContactSummary) => void;
  /** A person with an open lead already: "Open lead" goes to it (one open lead each, L6). */
  onOpenLead: (leadId: string) => void;
  onNewContact: () => void;
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

/**
 * New lead's Contact step (H:1890–1895): the 44px search — from 3 letters or 4
 * digits, eight people at most, "No existing match" — the Quick start chips,
 * the hits ("Open lead" for someone with one, "Re-create lead" for a patient,
 * "Use contact" for anyone else) and the 40px "New contact" row, which opens the
 * contact editor.
 */
export function NewLeadContactStep({
  query,
  onQueryChange,
  searchRef,
  hits,
  noMatch,
  pressed,
  onPreset,
  onPick,
  onOpenLead,
  onNewContact,
}: NewLeadContactStepProps) {
  const { t } = useTranslation(LEADS_NS);
  const { t: tEditor } = useTranslation(CONTACT_EDITOR_NS);
  const hitLine = useHitLine();
  return (
    <div
      data-slot="surface"
      className="bg-card flex flex-col overflow-hidden rounded-xl border"
    >
      <div className="text-foreground flex h-11 items-center gap-2 border-b px-3">
        <Search aria-hidden="true" className="text-muted-foreground size-4 flex-none" />
        <input
          ref={searchRef}
          value={query}
          maxLength={80}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t(K.search)}
          aria-label={t(K.searchAria)}
          data-testid={LEADS_TEST_IDS.newLeadSearch}
          className="text-field placeholder:text-muted-foreground h-full min-w-0 flex-1 bg-transparent outline-none"
        />
      </div>
      <fieldset
        aria-label={t(K.quickStart)}
        className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5 border-0 px-3"
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
                on ? 'bg-muted border-foreground' : 'bg-card hover:bg-muted',
              )}
            >
              <preset.icon
                aria-hidden="true"
                className="text-muted-foreground size-3.25"
              />
              {t(K.presets[preset.id])}
            </button>
          );
        })}
      </fieldset>
      <div className="flex flex-col">
        {hits.map((hit) => (
          <button
            key={hit.id}
            type="button"
            onClick={() => {
              if (hit.openLeadId) onOpenLead(hit.openLeadId);
              else onPick(hit);
            }}
            data-testid={`${LEADS_TEST_IDS.newLeadHit}-${hit.contactNumber}`}
            className="hover:bg-canvas border-b-muted flex items-center gap-2.5 border-b px-3 py-2 text-start"
          >
            <PersonAvatar
              initials={personInitials(hit.name)}
              tone={hit.patientId ? 'sage' : 'lav'}
              size="roster"
              patient={hit.patientId !== null}
            />
            <span className="flex min-w-0 flex-1 flex-col leading-[1.3]">
              <span
                dir="auto"
                className="text-body truncate [text-align:match-parent] font-medium"
              >
                {hit.name}
              </span>
              <span className="text-caption text-muted-foreground truncate">
                {hitLine(hit)}
              </span>
            </span>
            <span className="text-foreground-soft flex-none text-xs font-medium">
              {t(hitActionKey(hit))}
            </span>
          </button>
        ))}
        {noMatch ? (
          <span
            data-testid={LEADS_TEST_IDS.newLeadNoMatch}
            className="text-detail text-muted-foreground px-3 py-2.5"
          >
            {t(K.noMatch)}
          </span>
        ) : null}
        <button
          type="button"
          onClick={onNewContact}
          data-testid={LEADS_TEST_IDS.newLeadNewContact}
          className="bg-canvas hover:bg-muted text-body flex h-10 items-center gap-2 px-3 text-start font-medium"
        >
          <Plus aria-hidden="true" className="size-3.25" />
          {tEditor(CONTACT_EDITOR_KEYS.newContact)}
        </button>
      </div>
    </div>
  );
}
