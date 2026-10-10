import { useNavigate, useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import {
  organizationCheckInCreate,
  organizationTreatmentEdit,
} from '@/lib/routes/patient-file-builders.ts';
import {
  TREATMENT_LIMITS,
  type TreatmentRecord,
} from '@/shared/api/clinic/treatments-contracts.ts';
import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';
import { useCreateTreatment } from '@/shared/hooks/useTreatments/index.ts';
import { Copy, MessageSquare, PenLine, XCircle } from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  PATIENT_TABLE_KEYS,
  PATIENT_TABLE_NS,
} from '../../../shared/components/PatientSectionTable/index.ts';
import {
  treatmentFieldsOf,
  treatmentFormOf,
} from '../../components/TreatmentDrawer/index.ts';
import { TREATMENT_KEYS } from '../../treatments.constants.ts';

const K = PATIENT_TABLE_KEYS;

/** What the member may do to a treatment, read once by the section. */
export interface TreatmentRowAccess {
  /** `patient_treatment:create` (View-as: Doctor, Therapist, Owner) — Copy as next session. */
  canCreate: boolean;
  /** `patient_treatment:update` — Edit and Reverse. */
  canUpdate: boolean;
  /** `patient:update` (Patients Edit) — logging a check-in. */
  canCheckIn: boolean;
}

/**
 * A treatment row's actions (KICKOFF §6.6 Section tables; H:4754):
 * "Check-in" (the aftercare check-in drawer for this treatment, over the
 * section), "Copy as next session" (today's next session, "Session 2
 * added"), "Edit" and "Reverse" — the design's Delete, which the API does not
 * have — each behind its gate. A reversed session takes none: the row opens
 * it to read.
 */
export function useTreatmentRowActions({
  canCreate,
  canUpdate,
  canCheckIn,
  spendablePackageIds,
  onReverse,
}: TreatmentRowAccess & {
  /** The patient's packages that can still spend a session (the server's counts). */
  spendablePackageIds: ReadonlySet<string>;
  /** Opens "Reverse this treatment?". */
  onReverse: (treatment: TreatmentRecord) => void;
}): (treatment: TreatmentRecord) => DataTableRowAction[] {
  const { t } = useTranslation(PATIENT_TABLE_NS);
  const navigate = useNavigate();
  const { organizationSlug = '', patientId = '' } = useParams({ strict: false });
  const create = useCreateTreatment();

  // The same treatment again now, one session on — on its package while it can
  // spend one, which then numbers the session (the server's), as a drawer save does.
  const copy = (treatment: TreatmentRecord) => {
    const fields = treatmentFieldsOf(
      {
        ...treatmentFormOf(treatment),
        sessionNumber: Math.min(
          TREATMENT_LIMITS.session.max,
          treatment.sessionNumber + 1,
        ),
      },
      treatment.name,
    );
    create.mutate(
      {
        patientId: treatment.patientId,
        input: {
          ...fields,
          packageId:
            treatment.packageId && spendablePackageIds.has(treatment.packageId)
              ? treatment.packageId
              : null,
        },
      },
      {
        onSuccess: (saved) =>
          notify.success(t(K.treatments.copied, { session: saved.sessionNumber })),
      },
    );
  };

  return (treatment) => {
    if (treatment.status === 'reversed') return [];
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
    if (canCreate) {
      actions.push({
        id: 'copy',
        label: t(K.actions.copyTreatment),
        icon: Copy,
        onSelect: () => copy(treatment),
      });
    }
    if (canUpdate) {
      actions.push(
        {
          id: 'edit',
          label: t(K.actions.edit),
          icon: PenLine,
          onSelect: () =>
            void navigate(
              organizationTreatmentEdit(organizationSlug, patientId, treatment.id),
            ),
        },
        {
          id: 'reverse',
          label: t(TREATMENT_KEYS.reverse.action),
          icon: XCircle,
          destructive: true,
          onSelect: () => onReverse(treatment),
        },
      );
    }
    return actions;
  };
}
