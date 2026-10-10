import { Controller, useForm, useFormState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { isolateText } from '@/lib/bidi-isolate.ts';
import {
  PACKAGE_SESSIONS_MAX,
  type PatientPackageChange,
  type PatientPackageRow,
} from '@/shared/api/clinic/patient-packages-contracts.ts';
import {
  DrawerField,
  DrawerFieldGrid,
  DrawerStepper,
  useDrawerFieldIds,
} from '@/shared/components/DrawerField/index.ts';
import { DatePicker } from '@/shared/components/Picker/DatePicker/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import { useUpdatePatientPackage } from '@/shared/hooks/usePatientPackages/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { PACKAGE_KEYS, PACKAGE_NS, PACKAGE_TEST_ID } from '../../packages.constants.ts';

const K = PACKAGE_KEYS;

/** The form: the package's validity and its sessions. */
interface EditPackageValues {
  /** `YYYY-MM-DD`; `null` = no expiry. */
  validUntil: string | null;
  sessionsTotal: number;
}

/** The fields in the drawer's order — a server error opens the first one it names. */
const FIELD_ORDER = ['validUntil', 'sessionsTotal'] as const;

/** How far ahead the date list reaches — a package's validity runs a year or more; any date can be typed. */
const VALIDITY_DAYS_AHEAD = 400;

/** What changed, in the route's terms — the fields left as read are not sent. */
function changeOf(
  row: PatientPackageRow,
  values: EditPackageValues,
): PatientPackageChange | null {
  const change: PatientPackageChange = {
    ...(values.validUntil !== row.validUntil && { validUntil: values.validUntil }),
    ...(values.sessionsTotal !== row.sessionsTotal && {
      sessionsTotal: values.sessionsTotal,
    }),
  };
  return Object.keys(change).length > 0 ? change : null;
}

/** Props of {@link EditPackageDrawer}. */
export interface EditPackageDrawerProps {
  patientId: string;
  /** The package as read — its `updated_at` goes back as `expected_updated_at`. */
  row: PatientPackageRow;
  /** Read the packages again — the stale save's "Reload". */
  onReload: () => void;
  onClose: () => void;
}

/**
 * Edit package — component state, no route (KICKOFF §6.6 Drawers, D24; 560px
 * as Add package was drawn, H:4833–4835): "Edit package" over the package's
 * name; "Valid till" (a date, or none for no expiry) and "Sessions" (from what
 * was used up to 999); the summary "Sessions are counted when a treatment is
 * completed". `PATCH …/offerings/:patient_offering_id` (`payment:update`) with
 * the changed fields and `expected_updated_at`: the server's field errors
 * (before the invoice's date, below what was used) land on their fields, a
 * stale save toasts with "Reload"; "Package saved".
 */
export function EditPackageDrawer({
  patientId,
  row,
  onReload,
  onClose,
}: EditPackageDrawerProps) {
  const { t } = useTranslation(PACKAGE_NS);
  const update = useUpdatePatientPackage({ notifyOnError: false });
  const form = useForm<EditPackageValues>({
    defaultValues: { validUntil: row.validUntil, sessionsTotal: row.sessionsTotal },
  });
  const { isDirty } = useFormState({ control: form.control });
  const ids = useDrawerFieldIds(form, PACKAGE_TEST_ID);
  const validUntil = ids('validUntil');
  const sessions = ids('sessionsTotal');

  const { saveState, save } = useDrawerSave<EditPackageValues, PatientPackageRow | null>({
    form,
    fieldOrder: FIELD_ORDER,
    toastId: 'package-save-failed',
    onField: (field) => form.setFocus(field),
    onStale: onReload,
    write: async () => {
      const change = changeOf(row, form.getValues());
      if (!change) return null;
      return update.mutateAsync({ patientId, row, change });
    },
    onDone: (saved) => {
      if (saved) notify.success(t(K.saved));
      onClose();
    },
  });

  return (
    <RecordDrawer
      open
      onClose={onClose}
      title={t(K.title)}
      sub={isolateText(row.name)}
      content={{ fieldCount: 2 }}
      tone="mint"
      summary={t(K.summary)}
      saveLabel={t(K.save)}
      onSave={() => void save()}
      saveState={saveState}
      dirty={isDirty}
      testId={PACKAGE_TEST_ID}
    >
      <DrawerFieldGrid>
        <DrawerField
          span="half"
          label={t(K.validUntil)}
          htmlFor={validUntil.id}
          error={validUntil.error}
        >
          <Controller
            control={form.control}
            name="validUntil"
            render={({ field }) => (
              <DatePicker
                id={validUntil.id}
                aria-describedby={validUntil.control['aria-describedby']}
                invalid={Boolean(validUntil.error)}
                value={field.value}
                onChange={field.onChange}
                label={t(K.validUntil)}
                placeholder={t(K.card.noExpiry)}
                future={VALIDITY_DAYS_AHEAD}
                clearable
                size="md"
                testId={`${PACKAGE_TEST_ID}-valid-until`}
              />
            )}
          />
        </DrawerField>
        <DrawerField
          span="half"
          label={t(K.sessions)}
          htmlFor={sessions.id}
          error={sessions.error}
        >
          <Controller
            control={form.control}
            name="sessionsTotal"
            render={({ field }) => (
              <DrawerStepper
                {...sessions.control}
                ref={field.ref}
                label={t(K.sessions)}
                value={field.value}
                onValueChange={field.onChange}
                // Never below what was used, nor under one (PK6).
                min={Math.max(1, row.sessionsUsed)}
                max={PACKAGE_SESSIONS_MAX}
                testId={`${PACKAGE_TEST_ID}-sessions`}
              />
            )}
          />
        </DrawerField>
      </DrawerFieldGrid>
    </RecordDrawer>
  );
}
