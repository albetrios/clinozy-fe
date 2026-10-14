import { useTranslation } from 'react-i18next';

import { isolateValues } from '@/lib/bidi-isolate.ts';
import { defaultBranchId } from '@/shared/app/app-branch.ts';
import { toAppPhone } from '@/shared/app/app-phone.ts';
import {
  CONTACT_QUICK_PICK_KEYS,
  CONTACT_QUICK_PICK_NS,
  findQuickAddMobile,
  type QuickAddDraft,
} from '@/shared/components/ContactQuickPick/index.ts';
import {
  emptyPatientForm,
  patientInputOf,
} from '@/shared/components/PatientDrawer/patient-form.ts';
import { useBranches } from '@/shared/hooks/useBranches/index.ts';
import { useCreatePatient } from '@/shared/hooks/usePatients/index.ts';
import { usePreferences } from '@/shared/hooks/usePreferences/index.ts';
import { notify } from '@/shared/notify/index.ts';

import type { PatientPick } from './patient-pick.ts';

const K = CONTACT_QUICK_PICK_KEYS.patient;

/**
 * The patient field's quick add (change-contact-quick-pick D23): a patient file from a name and a
 * mobile, as New patient would open it (New, Aesthetic, the header's branch). The mobile is
 * looked up first (`GET /app/contacts?phone=`, the patient drawer's duplicate check): a patient
 * on it already is picked ("… is already a patient · picked"); someone the clinic knows without
 * a file gets one on their own record; anyone else is a new person (`POST /app/patients`). A
 * failure says why and rejects, so the quick add stays open with what was typed.
 */
export function useQuickAddPatient(): (draft: QuickAddDraft) => Promise<PatientPick> {
  const { t } = useTranslation(CONTACT_QUICK_PICK_NS);
  const create = useCreatePatient();
  const { openBranches } = useBranches();
  const { preferences } = usePreferences();
  return async ({ name, phone }) => {
    const mobile = toAppPhone(phone);
    const known = await findQuickAddMobile(mobile);
    if (known?.patientId) {
      notify.info(t(K.existing, isolateValues({ name: known.name })));
      return {
        id: known.patientId,
        contactId: known.id,
        name: known.name,
        phone: known.primaryPhone,
      };
    }
    const fields = patientInputOf(
      emptyPatientForm({ name, phone: mobile ?? undefined }),
      {
        defaultBranchId: defaultBranchId(openBranches, preferences.branchFilter),
      },
    );
    const patient = await create.mutateAsync({
      fields,
      person: known ? { contactId: known.id } : 'new',
    });
    notify.success(t(K.added, isolateValues({ name: patient.name })));
    return {
      id: patient.id,
      contactId: patient.contactId,
      name: patient.name,
      phone: patient.phone,
    };
  };
}
