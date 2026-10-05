import { useQueryClient } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import {
  organizationPrescription,
  organizationPrescriptionEdit,
} from '@/lib/routes/patient-file-builders.ts';
import type { Prescription } from '@/shared/api/clinic/clinic-schema.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import {
  fetchRxSheetContext,
  prescriptionQueryKeys,
} from '@/shared/api/clinic/prescriptions-api.ts';
import { clinicCommandNavigation } from '@/shared/clinic/clinic-command-targets.ts';
import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';
import {
  PrescriptionPrint,
  printDocument,
} from '@/shared/components/PrintTemplate/index.ts';
import { notifyError } from '@/shared/errors/errorHandler.ts';
import { useClinicNavigate } from '@/shared/hooks/useClinicNavigate/index.ts';
import { useCreatePrescription } from '@/shared/hooks/usePrescriptions/index.ts';
import { Copy, Eye, PenLine, Printer, Receipt, Trash } from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  PATIENT_TABLE_KEYS,
  PATIENT_TABLE_NS,
} from '../../../shared/components/PatientSectionTable/index.ts';

const keys = PATIENT_TABLE_KEYS;

/** What the member may do to a prescription, read once by the section. */
export interface PrescriptionRowAccess {
  /** The Doctor and Admin gate (`S:35, 37`): copy and edit. */
  writable: boolean;
  /** Writable and `patients.delete`. */
  canDelete: boolean;
  /** Medical's `create` — a sale. */
  canSell: boolean;
}

/**
 * A prescription row's actions (KICKOFF §6.6 Section tables; H:4753):
 * "Print" (the A4 sheet straight to the printer), "Preview"
 * (`prescriptions/$prescriptionId`), "Copy prescription" (today's copy,
 * "Prescription copied"), "Sell medicines" (the sale drawer with the Rx,
 * keeping the section behind it), "Edit" and "Delete" — each behind its gate.
 */
export function usePrescriptionRowActions({
  writable,
  canDelete,
  canSell,
  onDelete,
}: PrescriptionRowAccess & {
  /** Opens "Delete this prescription?". */
  onDelete: (prescription: Prescription) => void;
}): (prescription: Prescription) => DataTableRowAction[] {
  const { t } = useTranslation(PATIENT_TABLE_NS);
  const navigate = useClinicNavigate();
  const queryClient = useQueryClient();
  const { organizationSlug = '', patientId = '' } = useParams({ strict: false });
  const create = useCreatePrescription();

  const print = async (prescription: Prescription) => {
    try {
      const sheet = await queryClient.fetchQuery({
        queryKey: prescriptionQueryKeys.sheet(
          prescription.patientId,
          prescription.doctorId,
        ),
        queryFn: () => fetchRxSheetContext(prescription.patientId, prescription.doctorId),
      });
      await printDocument(
        <PrescriptionPrint
          prescription={prescription}
          patient={sheet.patient}
          doctor={sheet.doctor}
          organization={sheet.organization}
          branch={sheet.branch}
        />,
      );
    } catch (error) {
      notifyError(error);
    }
  };

  // Today's copy of the lines and notes; a follow-up belongs to its own visit.
  const copy = (prescription: Prescription) =>
    create.mutate(
      {
        patientId: prescription.patientId,
        appointmentId: null,
        doctorId: prescription.doctorId,
        date: clinicToday(),
        items: prescription.items,
        advice: prescription.advice,
        labReport: prescription.labReport,
        procedureToday: prescription.procedureToday,
        followUpDate: null,
      },
      { onSuccess: () => notify.success(t(keys.prescriptions.copied)) },
    );

  return (prescription) => {
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
    if (writable) {
      actions.push({
        id: 'copy',
        label: t(keys.actions.copyRx),
        icon: Copy,
        onSelect: () => copy(prescription),
      });
    }
    if (canSell) {
      actions.push({
        id: 'sell',
        label: t(keys.actions.sell),
        icon: Receipt,
        onSelect: () =>
          void navigate(
            clinicCommandNavigation('newSale', {
              organizationSlug,
              referrer: `patients/${patientId}/prescriptions`,
              search: { prescription: prescription.id },
            }),
          ),
      });
    }
    if (writable) {
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
    if (canDelete) {
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
