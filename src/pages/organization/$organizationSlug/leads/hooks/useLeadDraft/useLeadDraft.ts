import { useState } from 'react';

import type {
  LeadInterest,
  LeadSource,
  LeadStatus,
} from '@/shared/api/app/app-schema.ts';
import type { LeadFields, LeadRecord } from '@/shared/api/app/leads-contracts.ts';
import type { DrawerSaveState } from '@/shared/components/DrawerFooter/index.ts';
import { useUpdateLead } from '@/shared/hooks/useLeads/index.ts';

/** What the drawer drafts until "Save lead" (`leads.md:63–66`): the people apply at once. */
export interface LeadDraft {
  source: LeadSource | null;
  interests: readonly LeadInterest[];
  status: LeadStatus;
}

const draftOf = (lead: LeadRecord): LeadDraft => ({
  source: lead.source,
  interests: lead.interests,
  status: lead.status,
});

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((item, index) => item === b[index]);

/**
 * The draft over a newer read of its lead: a field the member left as the draft found it takes
 * the read's value — a booking moved the status to Appointment scheduled, a cancel back to
 * Follow-up — and a field they changed keeps their change.
 */
export function rebaseLeadDraft({
  draft,
  base,
  read,
}: {
  draft: LeadDraft;
  /** What the draft started from. */
  base: LeadDraft;
  read: LeadDraft;
}): LeadDraft {
  return {
    source: draft.source === base.source ? read.source : draft.source,
    interests: sameList(draft.interests, base.interests)
      ? read.interests
      : draft.interests,
    status: draft.status === base.status ? read.status : draft.status,
  };
}

const sameDraft = (a: LeadDraft, b: LeadDraft) =>
  a.source === b.source && a.status === b.status && sameList(a.interests, b.interests);

/** The draft's changes from the saved lead — empty when nothing changed. */
export function leadDraftFields(lead: LeadRecord, draft: LeadDraft): Partial<LeadFields> {
  const fields: Partial<LeadFields> = {};
  if (draft.source !== lead.source) fields.source = draft.source;
  if (!sameList(draft.interests, lead.interests)) fields.interests = [...draft.interests];
  if (draft.status !== lead.status) fields.status = draft.status;
  return fields;
}

/** The lead drawer's draft, its save and its discard. */
export interface LeadDraftState {
  draft: LeadDraft;
  update: (patch: Partial<LeadDraft>) => void;
  dirty: boolean;
  saveState: DrawerSaveState;
  save: () => void;
  discard: () => void;
}

/** The newer of two reads of one lead — a save's answer until the refetch catches up. */
const newerOf = (read: LeadRecord, saved: LeadRecord | null): LeadRecord =>
  saved && saved.id === read.id && saved.updatedAt > read.updatedAt ? saved : read;

/**
 * The lead drawer's draft (KICKOFF §6.3 Save): source, interests and status
 * held until "Save lead", which sends them with the read's `updated_at`
 * (`useUpdateLead` — a lead someone saved meanwhile is `409 record_changed`);
 * "Discard" drops it. A draft belongs to one lead — another lead starts from
 * its own record. A save's answer stands for the record until the refetch brings
 * it: the draft is clean at once, and the next save carries the new `updated_at`.
 * A newer read — the server moved the lead, as a booking or a cancel does —
 * carries into the fields the member left alone ({@link rebaseLeadDraft}).
 */
export function useLeadDraft(lead: LeadRecord): LeadDraftState {
  const [state, setState] = useState(() => ({
    id: lead.id,
    draft: draftOf(lead),
    base: draftOf(lead),
    saved: null as LeadRecord | null,
  }));
  const [saveState, setSaveState] = useState<DrawerSaveState>('idle');
  const save = useUpdateLead();
  // Another lead: the draft starts again from its record.
  if (state.id !== lead.id) {
    setState({ id: lead.id, draft: draftOf(lead), base: draftOf(lead), saved: null });
  }
  const record = newerOf(lead, state.saved);
  // The server moved the lead meanwhile (a booking, a cancel): what the member left follows it.
  const read = draftOf(record);
  if (state.id === lead.id && !sameDraft(read, state.base)) {
    setState((previous) => ({
      ...previous,
      draft: rebaseLeadDraft({ draft: previous.draft, base: previous.base, read }),
      base: read,
    }));
  }
  const draft = state.id === lead.id ? state.draft : draftOf(lead);
  const fields = leadDraftFields(record, draft);
  const dirty = Object.keys(fields).length > 0;

  return {
    draft,
    update: (next) =>
      setState((previous) => ({ ...previous, draft: { ...previous.draft, ...next } })),
    dirty,
    saveState,
    save: () => {
      if (!dirty || saveState === 'saving') return;
      setSaveState('saving');
      save.mutate(
        { lead: record, fields },
        {
          onSuccess: (saved) => {
            setSaveState('idle');
            setState({
              id: saved.id,
              draft: draftOf(saved),
              base: draftOf(saved),
              saved,
            });
          },
          onError: () => setSaveState('failed'),
        },
      );
    },
    discard: () => {
      setState((previous) => ({
        ...previous,
        draft: draftOf(record),
        base: draftOf(record),
      }));
      setSaveState('idle');
    },
  };
}
