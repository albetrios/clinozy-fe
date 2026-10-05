import { useNavigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { organizationPrescriptionCreate } from '@/lib/routes/patient-file-builders.ts';
import { passesPatientFileGate } from '@/shared/clinic/patient-file-sections.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useRxCatalog } from '@/shared/hooks/usePrescriptions/index.ts';
import { notify } from '@/shared/notify/index.ts';

import type { ClinicalLists } from '../../../shared/hooks/useClinicalLists/index.ts';
import { usePatientFileContext } from '../../../shared/patient-file-context.ts';
import { TIMELINE_KEYS, TIMELINE_NS } from '../../timeline.constants.ts';
import { parseSmartNote } from './smart-note.ts';

/** The smart note's text and what "Add" does with it. */
export interface SmartNote {
  note: string;
  setNote: (note: string) => void;
  apply: () => void;
}

/**
 * The Overview's smart note (KICKOFF §6.6; H:4917–4920 — the prototype's
 * "Add" called a handler it never defined, so the build wires it to the VM's
 * `apply`): the words it recognises become Complaints, Diagnosis and
 * Suggested chips at once ("3 items added from your note"); the medicines it
 * names open New prescription with a line each — never an Rx saved silently,
 * the Rx gate deciding (`S:35`; AMBER A-F5); nothing → "Nothing recognised
 * yet".
 */
export function useSmartNote(lists: ClinicalLists): SmartNote {
  const { t } = useTranslation(TIMELINE_NS);
  const navigate = useNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const { patientId } = usePatientFileContext();
  const access = useClinicAccess();
  const writesRx =
    access.isResolved && passesPatientFileGate(access.roles, 'prescriptions');
  const catalog = useRxCatalog(writesRx ? patientId : '');
  const [note, setNote] = useState('');

  const apply = () => {
    const names = writesRx ? (catalog.data?.medicines ?? []).map((row) => row.name) : [];
    const found = parseSmartNote(note, names);
    const count = found.chips.length + found.medicines.length;
    if (count === 0) {
      notify.info(t(TIMELINE_KEYS.clinical.nothing));
      return;
    }
    lists.addAll(found.chips);
    setNote('');
    notify.success(t(TIMELINE_KEYS.clinical.added, { count }));
    if (found.medicines.length > 0) {
      void navigate({
        ...organizationPrescriptionCreate(organizationSlug, patientId),
        search: { medicines: found.medicines },
      });
    }
  };

  return { note, setNote, apply };
}
