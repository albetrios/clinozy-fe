import { useCallback } from 'react';
import { create } from 'zustand';

import type { BodyPart, PrescriptionItem } from '@/shared/api/clinic/clinic-schema.ts';

/** One Rx line of the sheet's draft: the line, and whether the doctor reviewed it. */
export interface VisitDraftLine {
  /** Stable for the line's life (keys the list). */
  key: string;
  item: PrescriptionItem;
  reviewed: boolean;
}

/**
 * What the sheet keeps of a visit until Approve (`today.md:93`): the consult
 * note, the Rx lines and their review marks, the print language, and the
 * Treatment tab's settings and areas (`null` until touched — the last
 * session's then).
 */
export interface VisitDraft {
  complaint: string;
  findings: string;
  diagnoses: string[];
  plan: string;
  lines: VisitDraftLine[];
  language: 'en';
  settings: Record<string, string>;
  areas: BodyPart[] | null;
}

/** A visit's draft before anything is typed. */
export const EMPTY_VISIT_DRAFT: VisitDraft = {
  complaint: '',
  findings: '',
  diagnoses: [],
  plan: '',
  lines: [],
  language: 'en',
  settings: {},
  areas: null,
};

/** A draft change: the fields to set, or a function of the draft as it is. */
export type VisitDraftPatch =
  Partial<VisitDraft> | ((draft: VisitDraft) => Partial<VisitDraft>);

interface VisitDraftState {
  drafts: Readonly<Record<string, VisitDraft>>;
  update: (visitId: string, patch: VisitDraftPatch) => void;
  /** Forget a visit's draft — after Approve, or when the sheet starts the note over. */
  clear: (visitId: string) => void;
}

/**
 * The Visit sheet's drafts (KICKOFF §6.13: "a memory-only page store keyed by
 * `visitId`, never persisted, no records") — closing the sheet keeps them,
 * Approve clears the consult's. A reload forgets them; nothing here is a
 * record (server state stays in TanStack Query).
 */
export const useVisitDraftStore = create<VisitDraftState>()((set) => ({
  drafts: {},
  update: (visitId, patch) =>
    set((state) => {
      const draft = state.drafts[visitId] ?? EMPTY_VISIT_DRAFT;
      const change = typeof patch === 'function' ? patch(draft) : patch;
      return { drafts: { ...state.drafts, [visitId]: { ...draft, ...change } } };
    }),
  clear: (visitId) =>
    set((state) => ({
      drafts: Object.fromEntries(
        Object.entries(state.drafts).filter(([id]) => id !== visitId),
      ),
    })),
}));

/** One visit's draft and its setter. */
export function useVisitDraft(visitId: string): {
  draft: VisitDraft;
  update: (patch: VisitDraftPatch) => void;
} {
  const draft = useVisitDraftStore((state) => state.drafts[visitId] ?? EMPTY_VISIT_DRAFT);
  const set = useVisitDraftStore((state) => state.update);
  const update = useCallback(
    (patch: VisitDraftPatch) => set(visitId, patch),
    [set, visitId],
  );
  return { draft, update };
}
