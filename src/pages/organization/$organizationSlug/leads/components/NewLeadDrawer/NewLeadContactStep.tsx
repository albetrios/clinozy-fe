import type { Ref } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import type { LeadContactHit } from '@/shared/api/clinic/leads-contracts.ts';
import { formatClinicPhone } from '@/shared/clinic/clinic-phone.ts';
import { PersonAvatar, personInitials } from '@/shared/components/Cells/index.ts';
import {
  CONTACT_EDITOR_KEYS,
  CONTACT_EDITOR_NS,
} from '@/shared/forms/ContactEditor/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
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
  hits: readonly LeadContactHit[];
  noMatch: boolean;
  /** Which Quick start chip the form's values match. */
  pressed: (preset: NewLeadPreset) => boolean;
  onPreset: (preset: NewLeadPreset) => void;
  onPick: (hit: LeadContactHit) => void;
  onNewContact: () => void;
}

/** A hit's second line: "Patient #3508 · last visit 24 Sep" or "Lead #2365 · +91 98250 11241". */
function useHitLine() {
  const { t } = useTranslation(LEADS_NS);
  const { formatDate } = useLocaleFormat();
  return (hit: LeadContactHit) => {
    if (hit.kind === 'patient') {
      const id = displayId.patient(hit.seq);
      if (!hit.lastVisit) return t(K.hits.patientNew, { id });
      // "Today" for a visit today, as the design words it (H:3318, H:5824); else "24 Sep".
      const date =
        hit.lastVisit === clinicToday()
          ? t(K.hits.today)
          : formatDate(
              hit.lastVisit,
              { day: 'numeric', month: 'short' },
              { civilDay: true },
            );
      return t(K.hits.patient, { id, date });
    }
    const phone = formatClinicPhone(hit.phone);
    return hit.contactThread
      ? t(K.hits.contact, { phone })
      : t(K.hits.lead, { id: displayId.lead(hit.seq), phone });
  };
}

/**
 * New lead's Contact step (H:1890–1895): the 44px search — from two
 * characters, five people at most, "No existing match" — the Quick start
 * chips, the hits ("Re-create lead" for a patient, "Use contact" for anyone
 * else) and the 40px "New contact" row, which opens the contact editor.
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
      <div
        role="group"
        aria-label={t(K.quickStart)}
        className="mt-2 flex flex-wrap items-center gap-1.5 px-3"
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
      </div>
      <div className="flex flex-col">
        {hits.map((hit) => (
          <button
            key={`${hit.kind}-${hit.id}`}
            type="button"
            onClick={() => onPick(hit)}
            data-testid={`${LEADS_TEST_IDS.newLeadHit}-${hit.kind}-${hit.seq}`}
            className="hover:bg-canvas border-b-muted flex items-center gap-2.5 border-b px-3 py-2 text-start"
          >
            <PersonAvatar
              initials={personInitials(hit.name)}
              tone={hit.kind === 'patient' ? 'sage' : 'lav'}
              size="roster"
              patient={hit.kind === 'patient'}
            />
            <span className="flex min-w-0 flex-1 flex-col leading-[1.3]">
              <span className="text-body truncate font-medium">{hit.name}</span>
              <span className="text-caption text-muted-foreground truncate">
                {hitLine(hit)}
              </span>
            </span>
            <span className="text-foreground-soft flex-none text-xs font-medium">
              {t(hit.kind === 'patient' ? K.hits.recreate : K.hits.useContact)}
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
