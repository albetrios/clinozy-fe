import { useNavigate, useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type { Prescription } from '@/shared/api/clinic/clinic-schema.ts';
import { clinicCommandNavigation } from '@/shared/clinic/clinic-command-targets.ts';
import {
  PrescriptionPrint,
  printDocument,
} from '@/shared/components/PrintTemplate/index.ts';
import { useRxSheetContext } from '@/shared/hooks/usePrescriptions/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { RX_KEYS, RX_NS } from '../../prescriptions.constants.ts';

/**
 * The A4 sheet of a prescription as it stands, once the sheet's patient,
 * doctor, clinic and branch are read — nothing before then.
 */
export function useRxPrint(patientId: string, doctorId: string | null) {
  const sheet = useRxSheetContext(patientId, doctorId);
  return (rx: Prescription) => {
    if (!sheet.data) return;
    void printDocument(
      <PrescriptionPrint
        prescription={rx}
        patient={sheet.data.patient}
        doctor={sheet.data.doctor}
        organization={sheet.data.organization}
        branch={sheet.data.branch}
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
 * from it with the prescriptions section kept behind (`from`, §4).
 */
export function useRxDone({
  editing,
  approving,
  patientId,
  print,
  onClose,
}: {
  editing: boolean;
  approving: boolean;
  patientId: string;
  print: (rx: Prescription) => void;
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
    if (approving) print(saved);
    if (!sell) {
      onClose();
      return;
    }
    void navigate(
      clinicCommandNavigation('newSale', {
        organizationSlug,
        referrer: `patients/${patientId}/prescriptions`,
        search: { prescription: saved.id },
      }),
    );
  };
}
