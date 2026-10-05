import { useNavigate, useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type { Prescription } from '@/shared/api/clinic/clinic-schema.ts';
import { clinicCommandNavigation } from '@/shared/clinic/clinic-command-targets.ts';
import {
  PrescriptionPrint,
  printDocument,
} from '@/shared/components/PrintTemplate/index.ts';
import {
  useLoadRxSheetContext,
  useRxSheetContext,
} from '@/shared/hooks/usePrescriptions/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { RX_KEYS, RX_NS } from '../../prescriptions.constants.ts';

/**
 * The A4 sheet of a prescription as it stands. The sheet's patient, doctor,
 * clinic and branch are read ahead, so a print is instant; one asked for before
 * they land waits for them — never skipped — and goes on even if the drawer has
 * closed meanwhile. A failed read has toasted itself, with Retry.
 */
export function useRxPrint(patientId: string, doctorId: string | null) {
  useRxSheetContext(patientId, doctorId);
  const loadSheet = useLoadRxSheetContext();
  return async (rx: Prescription): Promise<void> => {
    const sheet = await loadSheet(rx.patientId, rx.doctorId).catch(() => null);
    if (!sheet) return;
    await printDocument(
      <PrescriptionPrint
        prescription={rx}
        patient={sheet.patient}
        doctor={sheet.doctor}
        organization={sheet.organization}
        branch={sheet.branch}
      />,
    );
  };
}

/**
 * A new Rx written in the visit flow approves at its visit: tied to the visit's
 * booking (Today's pharmacy lane, Medical's to fill), printed on save. An edit,
 * or a drawer outside the flow, is neither.
 */
export function rxVisitMode(
  visit: { appointmentId: string | null } | undefined,
  prescription: Prescription | null,
): { approving: boolean; appointmentId: string | null } {
  if (!visit || prescription) return { approving: false, appointmentId: null };
  return { approving: true, appointmentId: visit.appointmentId };
}

/** The save button's words: Save changes, Approve · print · send to pharmacy (the visit flow), or Save prescription. */
export function rxSaveLabelKey(editing: boolean, approving: boolean): string {
  if (editing) return RX_KEYS.save.edit;
  return approving ? RX_KEYS.save.visit : RX_KEYS.save.create;
}

/**
 * What a landed save does: "Prescription saved" (or "#500 saved" on an edit);
 * in the visit flow the new Rx prints on A4 (the Visit sheet's Approve, L-64);
 * then the drawer closes — or, after "Save & sell", a new medical sale opens
 * from it, closing back to `sellFrom` (§4): the visit flow when the drawer came
 * from it, else the patient's prescriptions.
 */
export function useRxDone({
  editing,
  approving,
  sellFrom,
  print,
  onClose,
}: {
  editing: boolean;
  approving: boolean;
  /** The room the sale "Save & sell" opens closes back to (`from`). */
  sellFrom: string;
  print: (rx: Prescription) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation(RX_NS);
  const navigate = useNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  return (saved: Prescription, sell: boolean) => {
    notify.success(
      editing
        ? t(RX_KEYS.save.savedNumber, { number: displayId.prescription(saved.seq) })
        : t(RX_KEYS.save.saved),
    );
    if (approving) void print(saved);
    if (!sell) {
      onClose();
      return;
    }
    void navigate(
      clinicCommandNavigation('newSale', {
        organizationSlug,
        referrer: sellFrom,
        search: { prescription: saved.id },
      }),
    );
  };
}
