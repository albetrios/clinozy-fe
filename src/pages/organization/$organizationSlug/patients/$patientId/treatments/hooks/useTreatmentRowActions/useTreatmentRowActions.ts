import { useNavigate, useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import {
  organizationCheckInCreate,
  organizationTreatmentEdit,
} from '@/lib/routes/patient-file-builders.ts';
import type { Treatment } from '@/shared/api/clinic/clinic-schema.ts';
import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';
import { useCreateTreatment } from '@/shared/hooks/useTreatments/index.ts';
import { Copy, MessageSquare, PenLine, Trash } from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  PATIENT_TABLE_KEYS,
  PATIENT_TABLE_NS,
} from '../../../shared/components/PatientSectionTable/index.ts';
import {
  treatmentFormOf,
  treatmentInputOf,
} from '../../components/TreatmentDrawer/index.ts';

const K = PATIENT_TABLE_KEYS;

/** The highest session number the drawer takes (`sessionNo` ≤ 99). */
const LAST_SESSION = 99;

/** What the member may do to a treatment, read once by the section. */
export interface TreatmentRowAccess {
  /** The Doctor and Therapist gate (`S:38–39`): copy and edit. */
  writable: boolean;
  /** Writable and `patients.delete`. */
  canDelete: boolean;
  /** `patients.edit` — logging a check-in. */
  canCheckIn: boolean;
}

/**
 * A treatment row's actions (KICKOFF §6.6 Section tables; H:4754):
 * "Check-in" (the aftercare check-in drawer for this treatment, over the
 * section), "Copy as next session" (today's next session, "Session 2
 * added"), "Edit" and "Delete" — each behind its gate.
 */
export function useTreatmentRowActions({
  writable,
  canDelete,
  canCheckIn,
  onDelete,
}: TreatmentRowAccess & {
  /** Opens "Delete this treatment?". */
  onDelete: (treatment: Treatment) => void;
}): (treatment: Treatment) => DataTableRowAction[] {
  const { t } = useTranslation(PATIENT_TABLE_NS);
  const navigate = useNavigate();
  const { organizationSlug = '', patientId = '' } = useParams({ strict: false });
  const create = useCreateTreatment();

  // The same treatment again today, one session on; the package (if any)
  // counts it, as a save from the drawer does.
  const copy = (treatment: Treatment) => {
    const session = Math.min(LAST_SESSION, treatment.sessionNo + 1);
    create.mutate(
      treatmentInputOf(
        { ...treatmentFormOf(treatment), sessionNo: session },
        {
          patientId: treatment.patientId,
          appointmentId: null,
          performedAt: new Date().toISOString(),
          fallbackName: treatment.name,
        },
      ),
      { onSuccess: () => notify.success(t(K.treatments.copied, { session })) },
    );
  };

  return (treatment) => {
    const actions: DataTableRowAction[] = [];
    if (canCheckIn) {
      actions.push({
        id: 'check-in',
        label: t(K.actions.checkIn),
        icon: MessageSquare,
        onSelect: () =>
          void navigate({
            ...organizationCheckInCreate(organizationSlug, patientId),
            search: { from: 'treatments', treatment: treatment.id },
          }),
      });
    }
    if (writable) {
      actions.push(
        {
          id: 'copy',
          label: t(K.actions.copyTreatment),
          icon: Copy,
          onSelect: () => copy(treatment),
        },
        {
          id: 'edit',
          label: t(K.actions.edit),
          icon: PenLine,
          onSelect: () =>
            void navigate(
              organizationTreatmentEdit(organizationSlug, patientId, treatment.id),
            ),
        },
      );
    }
    if (canDelete) {
      actions.push({
        id: 'delete',
        label: t(K.actions.delete),
        icon: Trash,
        destructive: true,
        onSelect: () => onDelete(treatment),
      });
    }
    return actions;
  };
}
