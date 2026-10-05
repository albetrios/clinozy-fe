import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { patientFileQueryKeys } from '@/shared/api/clinic/patient-file-api.ts';
import type { PatientFile } from '@/shared/api/clinic/patient-file-contracts.ts';
import type { PatientRecord } from '@/shared/api/clinic/patients-contracts.ts';
import { useUpdatePatient } from '@/shared/hooks/usePatients/index.ts';

import {
  type ClinicalField,
  clinicalItems,
  clinicalText,
} from '../../patient-clinical.ts';

/** What the chip cards read and write. */
export interface ClinicalLists {
  /** A card's chips — the edit in flight first, else the saved note. */
  items: (field: ClinicalField) => readonly string[];
  /** The chips added to a card this visit to the file — ringed, and the "1 new" pill. */
  fresh: (field: ClinicalField) => ReadonlySet<string>;
  add: (field: ClinicalField, text: string) => void;
  /**
   * Add several chips at once — the Overview's smart note: one write for all
   * the lists, a chip a list already holds (any case) left as it is; how many
   * were added.
   */
  addAll: (entries: readonly { field: ClinicalField; text: string }[]) => number;
  remove: (field: ClinicalField, text: string) => void;
}

type Lists = Partial<Record<ClinicalField, readonly string[]>>;

/** `drafts` without the cards `written` still holds — an edit made since stays. */
function settled(drafts: Lists, written: Lists): Lists {
  return Object.fromEntries(
    Object.entries(drafts).filter(
      ([field, items]) => written[field as ClinicalField] !== items,
    ),
  ) as Lists;
}

/**
 * The clinical chip cards' state (KICKOFF §6.6 Clinical notes; `updatePatient`,
 * `S:1640`): each add or remove shows at once and writes the whole note; the
 * saved note goes into the file's cache when the write lands, and a refused
 * write puts the chips back (its error toasts). "Added since the last visit"
 * has no marker in the contract (Appendix F), so the chips added here, this
 * visit to the file, stand in for it.
 */
export function useClinicalLists(patient: PatientRecord | undefined): ClinicalLists {
  const queryClient = useQueryClient();
  const update = useUpdatePatient();
  const [drafts, setDrafts] = useState<Lists>({});
  const [added, setAdded] = useState<Lists>({});

  const items = (field: ClinicalField) =>
    drafts[field] ?? clinicalItems(patient?.[field]);

  /** Show `next` at once and write the cards it holds in one patient write. */
  const write = (next: Lists) => {
    if (!patient) return;
    const fields = Object.keys(next) as ClinicalField[];
    const patch: Partial<Record<ClinicalField, string | null>> = {};
    for (const field of fields) patch[field] = clinicalText(next[field] ?? []);
    setDrafts((current) => ({ ...current, ...next }));
    // Only the latest edit of a card clears its draft; an earlier one landing late leaves it.
    const settle = () => setDrafts((current) => settled(current, next));
    update.mutateAsync({ id: patient.id, patch }).then((saved) => {
      const written: Partial<Record<ClinicalField, string | null>> = {};
      for (const field of fields) written[field] = saved[field];
      queryClient.setQueryData<PatientFile>(
        patientFileQueryKeys.detail(patient.id),
        (file) => (file ? { ...file, patient: { ...file.patient, ...written } } : file),
      );
      settle();
    }, settle);
  };

  /** Mark chips as added this visit to the file. */
  const markAdded = (lists: Lists) =>
    setAdded((current) => {
      const next = { ...current };
      for (const [field, texts] of Object.entries(lists) as [ClinicalField, string[]][])
        next[field] = [...(next[field] ?? []), ...texts];
      return next;
    });

  return {
    items,
    fresh: (field) => new Set(added[field] ?? []),
    add: (field, text) => {
      write({ [field]: [...items(field), text] });
      markAdded({ [field]: [text] });
    },
    addAll: (entries) => {
      const fresh: Partial<Record<ClinicalField, string[]>> = {};
      for (const { field, text } of entries) {
        const known = [...items(field), ...(fresh[field] ?? [])];
        if (known.some((item) => item.toLowerCase() === text.toLowerCase())) continue;
        fresh[field] = [...(fresh[field] ?? []), text];
      }
      const lists = Object.entries(fresh) as [ClinicalField, string[]][];
      if (lists.length === 0) return 0;
      write(
        Object.fromEntries(
          lists.map(([field, texts]) => [field, [...items(field), ...texts]]),
        ),
      );
      markAdded(fresh);
      return lists.reduce((sum, [, texts]) => sum + texts.length, 0);
    },
    remove: (field, text) => {
      write({ [field]: items(field).filter((item) => item !== text) });
      setAdded((current) => ({
        ...current,
        [field]: (current[field] ?? []).filter((item) => item !== text),
      }));
    },
  };
}
