import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { patientFileQueryKeys } from '@/shared/api/clinic/patient-file-api.ts';
import type { PatientFile } from '@/shared/api/clinic/patient-file-contracts.ts';
import type { PatientRecord } from '@/shared/api/clinic/patients-contracts.ts';
import { useUpdatePatient } from '@/shared/hooks/usePatients/index.ts';

import { clinicalItems, clinicalText } from '../../../shared/patient-clinical.ts';
import type { ClinicalField } from '../../overview.constants.ts';

/** What the chip cards read and write. */
export interface ClinicalLists {
  /** A card's chips — the edit in flight first, else the saved note. */
  items: (field: ClinicalField) => readonly string[];
  /** The chips added to a card this visit to the file — ringed, and the "1 new" pill. */
  fresh: (field: ClinicalField) => ReadonlySet<string>;
  add: (field: ClinicalField, text: string) => void;
  remove: (field: ClinicalField, text: string) => void;
}

type Lists = Partial<Record<ClinicalField, readonly string[]>>;

/** `lists` without `field`. */
function without(lists: Lists, field: ClinicalField): Lists {
  return Object.fromEntries(
    Object.entries(lists).filter(([key]) => key !== field),
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

  const write = (field: ClinicalField, next: readonly string[]) => {
    if (!patient) return;
    setDrafts((current) => ({ ...current, [field]: next }));
    // Only the latest edit of a card clears its draft; an earlier one landing late leaves it.
    const settle = () =>
      setDrafts((current) =>
        current[field] === next ? without(current, field) : current,
      );
    update
      .mutateAsync({ id: patient.id, patch: { [field]: clinicalText(next) } })
      .then((saved) => {
        queryClient.setQueryData<PatientFile>(
          patientFileQueryKeys.detail(patient.id),
          (file) =>
            file
              ? { ...file, patient: { ...file.patient, [field]: saved[field] } }
              : file,
        );
        settle();
      }, settle);
  };

  return {
    items,
    fresh: (field) => new Set(added[field] ?? []),
    add: (field, text) => {
      write(field, [...items(field), text]);
      setAdded((current) => ({ ...current, [field]: [...(current[field] ?? []), text] }));
    },
    remove: (field, text) => {
      write(
        field,
        items(field).filter((item) => item !== text),
      );
      setAdded((current) => ({
        ...current,
        [field]: (current[field] ?? []).filter((item) => item !== text),
      }));
    },
  };
}
