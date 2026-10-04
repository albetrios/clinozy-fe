import { useState } from 'react';

import type { LeadInterest, LeadStatus } from '@/shared/api/clinic/clinic-schema.ts';
import type {
  LeadPatch,
  LeadRecord,
  LeadRecordSource,
} from '@/shared/api/clinic/leads-contracts.ts';
import type { DrawerSaveState } from '@/shared/components/DrawerFooter/index.ts';
import { useUpdateLead } from '@/shared/hooks/useLeads/index.ts';

/** What the drawer drafts until "Save lead" (`leads.md:63–66`): the people apply at once. */
export interface LeadDraft {
  source: LeadRecordSource | null;
  interests: readonly LeadInterest[];
  customInterests: readonly string[];
  status: LeadStatus | null;
}

const draftOf = (lead: LeadRecord): LeadDraft => ({
  source: lead.source,
  interests: lead.interests,
  customInterests: lead.customInterests,
  status: lead.status,
});

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((item, index) => item === b[index]);

/** The draft's changes from the saved lead, as a patch — empty when nothing changed. */
export function leadDraftPatch(lead: LeadRecord, draft: LeadDraft): LeadPatch {
  const patch: LeadPatch = {};
  if (draft.source !== lead.source && draft.source !== null) patch.source = draft.source;
  if (!sameList(draft.interests, lead.interests)) patch.interests = [...draft.interests];
  if (!sameList(draft.customInterests, lead.customInterests)) {
    patch.customInterests = [...draft.customInterests];
  }
  if (draft.status !== lead.status && draft.status !== null) patch.status = draft.status;
  return patch;
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

/**
 * The lead drawer's draft (KICKOFF §6.3 Save): source, interests and status
 * held until "Save lead", which saves through `useUpdateLead` (the status's
 * side effects and their Undo are its own); "Discard" drops it. A draft
 * belongs to one lead — another lead starts from its own record.
 */
export function useLeadDraft(lead: LeadRecord, viewerId: string | null): LeadDraftState {
  const [state, setState] = useState(() => ({ id: lead.id, draft: draftOf(lead) }));
  const [saveState, setSaveState] = useState<DrawerSaveState>('idle');
  const save = useUpdateLead();
  // Another lead, or the same one saved: the draft starts again from the record.
  if (state.id !== lead.id) setState({ id: lead.id, draft: draftOf(lead) });
  const draft = state.id === lead.id ? state.draft : draftOf(lead);
  const patch = leadDraftPatch(lead, draft);
  const dirty = Object.keys(patch).length > 0;

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
        { id: lead.id, patch, viewerId },
        {
          onSuccess: ({ lead: saved }) => {
            setSaveState('idle');
            setState({ id: saved.id, draft: draftOf(saved) });
          },
          onError: () => setSaveState('failed'),
        },
      );
    },
    discard: () => {
      setState({ id: lead.id, draft: draftOf(lead) });
      setSaveState('idle');
    },
  };
}
