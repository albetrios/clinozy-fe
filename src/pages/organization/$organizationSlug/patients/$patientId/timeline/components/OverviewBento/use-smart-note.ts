import { useNavigate, useParams } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { organizationPrescriptionCreate } from '@/lib/routes/patient-file-builders.ts';
import { passesPatientFileGate } from '@/shared/app/patient-file-sections.ts';
import { reportError } from '@/shared/errors/errorHandler.ts';
import { useAppAccess } from '@/shared/hooks/useAppAccess/index.ts';
import { useRxCatalog } from '@/shared/hooks/usePrescriptions/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';

import type { ClinicalLists } from '../../../shared/hooks/useClinicalLists/index.ts';
import { usePatientFileContext } from '../../../shared/patient-file-context.ts';
import { TIMELINE_KEYS, TIMELINE_NS } from '../../timeline.constants.ts';
import {
  loadSmartNoteReading,
  parseSmartNote,
  type SmartNoteReading,
} from './smart-note.ts';

/** The smart note's text and what "Add" does with it. */
export interface SmartNote {
  note: string;
  setNote: (note: string) => void;
  /** Read the note — resolves once its chips are filed (or why not is said). */
  apply: () => Promise<void>;
}

/**
 * The Overview's smart note (KICKOFF §6.6; H:4917–4920 — the prototype's
 * "Add" called a handler it never defined, so the build wires it to the VM's
 * `apply`): a local keyword parser, not AI (Q15) — read with the UI
 * language's words, then English (L-64), the words it recognises become
 * Complaints, Diagnosis and Suggested chips at once, each its own clinical
 * note (one `POST` a chip, api-integration §5.4; "3 items added from your
 * note"); the medicines it names open New
 * prescription with a line each — never an Rx saved silently, the Rx gate
 * deciding (`S:35`; AMBER A-F5); nothing → "Nothing recognised yet". The
 * language's words load while the note is typed; if they cannot, "Add" says
 * so with a Retry rather than claim it recognised nothing.
 */
export function useSmartNote(lists: ClinicalLists): SmartNote {
  const { t } = useTranslation(TIMELINE_NS);
  const navigate = useNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const { patientId } = usePatientFileContext();
  const access = useAppAccess();
  const locale = useLocaleStore((state) => state.locale);
  const writesRx = access.isResolved && passesPatientFileGate(access, 'prescriptions');
  const catalog = useRxCatalog(writesRx ? patientId : '');
  const [note, setNote] = useState('');
  // One "Add" at a time: Enter and the button can both fire while the words load.
  const applying = useRef(false);

  useEffect(() => {
    // Warm-up only: "Add" loads them again and reports a failure itself.
    loadSmartNoteReading(locale).catch(() => undefined);
  }, [locale]);

  const apply = async () => {
    if (applying.current) return;
    applying.current = true;
    const typed = note;
    let reading: SmartNoteReading;
    try {
      reading = await loadSmartNoteReading(locale);
    } catch (error) {
      reportError(error, { scope: 'patient-file.smartNote.words', locale });
      notify.error(t(ERRORS_KEYS.frontend.query.loadFailed, { ns: ERRORS_NS }), {
        action: {
          label: t(ERRORS_KEYS.frontend.query.retry, { ns: ERRORS_NS }),
          onClick: () => void apply(),
        },
      });
      return;
    } finally {
      applying.current = false;
    }
    const names = writesRx ? (catalog.data?.medicines ?? []).map((row) => row.name) : [];
    const found = parseSmartNote(typed, names, reading);
    const count = found.chips.length + found.medicines.length;
    if (count === 0) {
      notify.info(t(TIMELINE_KEYS.clinical.nothing));
      return;
    }
    lists.addAll(found.chips);
    // What was typed while the words loaded stays.
    setNote((current) => (current === typed ? '' : current));
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
