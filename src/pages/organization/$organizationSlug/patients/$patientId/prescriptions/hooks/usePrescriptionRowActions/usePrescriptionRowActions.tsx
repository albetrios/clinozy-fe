import { useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import {
  organizationPrescription,
  organizationPrescriptionEdit,
} from '@/lib/routes/patient-file-builders.ts';
import { appToday } from '@/shared/api/app/app-time.ts';
import type { PrescriptionRecord } from '@/shared/api/app/prescriptions-contracts.ts';
import { appCommandNavigation } from '@/shared/app/app-command-targets.ts';
import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';
import { useAppNavigate } from '@/shared/hooks/useAppNavigate/index.ts';
import { useCreatePrescription } from '@/shared/hooks/usePrescriptions/index.ts';
import { Copy, Eye, PenLine, Printer, Receipt, Trash } from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  PATIENT_TABLE_KEYS,
  PATIENT_TABLE_NS,
} from '../../../shared/components/PatientSectionTable/index.ts';
import type { PrescriptionDrawerAccess } from '../../components/PrescriptionDrawer/index.ts';
import { useRxPrint } from '../../components/RxPrintPreview/index.ts';

const keys = PATIENT_TABLE_KEYS;

/**
 * A prescription row's actions (KICKOFF §6.6 Section tables; H:4753):
 * "Print" (the A4 sheet straight to the printer — the browser's, §6 #26),
 * "Preview" (`prescriptions/$prescriptionId`), "Copy prescription" (today's
 * copy, a new draft — "Prescription copied"), "Sell medicines" (an approved
 * one: the sale drawer with the Rx, keeping the section behind it), and on a
 * draft "Edit" and "Delete" — each behind its gate (the section reads the
 * member's access once). An approved prescription is final (Q19): no Edit, no
 * Delete.
 */
export function usePrescriptionRowActions({
  writes,
  approves,
  deletes,
  sells,
  onDelete,
}: PrescriptionDrawerAccess & {
  /** Opens "Delete this prescription?". */
  onDelete: (prescription: PrescriptionRecord) => void;
}): (prescription: PrescriptionRecord) => DataTableRowAction[] {
  const { t } = useTranslation(PATIENT_TABLE_NS);
  const navigate = useAppNavigate();
  const { organizationSlug = '', patientId = '' } = useParams({ strict: false });
  const create = useCreatePrescription();
  const print = useRxPrint();

  // Today's copy of the lines and notes, a draft; a follow-up belongs to its own visit.
  const copy = (prescription: PrescriptionRecord) =>
    create.mutate(
      {
        patientId: prescription.patientId,
        fields: {
          doctorId: prescription.doctorId,
          date: appToday(),
          items: prescription.items,
          advice: prescription.advice,
          labReport: prescription.labReport,
          procedureToday: prescription.procedureToday,
        },
      },
      { onSuccess: () => notify.success(t(keys.prescriptions.copied)) },
    );

  return (prescription) => {
    const draft = prescription.status === 'draft';
    const actions: DataTableRowAction[] = [
      {
        id: 'print',
        label: t(keys.actions.print),
        icon: Printer,
        onSelect: () => void print(prescription),
      },
      {
        id: 'preview',
        label: t(keys.actions.preview),
        icon: Eye,
        onSelect: () =>
          void navigate(
            organizationPrescription(organizationSlug, patientId, prescription.id),
          ),
      },
    ];
    if (writes) {
      actions.push({
        id: 'copy',
        label: t(keys.actions.copyRx),
        icon: Copy,
        onSelect: () => copy(prescription),
      });
    }
    if (sells && !draft) {
      actions.push({
        id: 'sell',
        label: t(keys.actions.sell),
        icon: Receipt,
        onSelect: () =>
          void navigate(
            appCommandNavigation('newSale', {
              organizationSlug,
              referrer: `patients/${patientId}/prescriptions`,
              search: { prescription: prescription.id },
            }),
          ),
      });
    }
    if (approves && draft) {
      actions.push({
        id: 'edit',
        label: t(keys.actions.edit),
        icon: PenLine,
        onSelect: () =>
          void navigate(
            organizationPrescriptionEdit(organizationSlug, patientId, prescription.id),
          ),
      });
    }
    if (deletes && draft) {
      actions.push({
        id: 'delete',
        label: t(keys.actions.delete),
        icon: Trash,
        destructive: true,
        onSelect: () => onDelete(prescription),
      });
    }
    return actions;
  };
}
