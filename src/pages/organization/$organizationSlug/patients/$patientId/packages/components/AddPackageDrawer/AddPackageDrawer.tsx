import { useForm, useFormState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { PackageOffering } from '@/shared/api/clinic/patient-packages-api.ts';
import {
  DrawerChips,
  DrawerField,
  DrawerFieldGrid,
  DrawerInfo,
} from '@/shared/components/DrawerField/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import { useFormValues } from '@/shared/hooks/useFormValues/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import {
  useAddPatientPackage,
  usePackageOfferings,
} from '@/shared/hooks/usePatientPackages/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { PACKAGE_KEYS, PACKAGE_NS, PACKAGE_TEST_ID } from '../../packages.constants.ts';

const K = PACKAGE_KEYS;

/** The drawer's one field. */
interface AddPackageValues {
  offeringId: string | null;
}

/** The chips: every offering of more than one session, each in its tone. */
function PackageChips({
  offerings,
  value,
  onChange,
}: {
  offerings: readonly PackageOffering[] | undefined;
  value: string | null;
  onChange: (offeringId: string | null) => void;
}) {
  const { t } = useTranslation(PACKAGE_NS);
  const formatPaise = usePaiseFormat();
  if (offerings?.length === 0) {
    return <DrawerInfo testId={`${PACKAGE_TEST_ID}-empty`}>{t(K.empty)}</DrawerInfo>;
  }
  return (
    <DrawerChips
      label={t(K.step)}
      options={(offerings ?? []).map((offering) => ({
        value: offering.id,
        label: t(K.option, {
          name: offering.name,
          sessions: offering.sessions,
          price: formatPaise(offering.price),
        }),
        tone: offering.tone,
      }))}
      value={value}
      onChange={onChange}
      testId={`${PACKAGE_TEST_ID}-offering`}
    />
  );
}

/** Props of {@link AddPackageDrawer}. */
export interface AddPackageDrawerProps {
  patientId: string;
  /** The patient's full name — the sub line (H:4835). */
  patientName: string;
  onClose: () => void;
}

/**
 * Add package — component state, no route (KICKOFF §6.6 Drawers, D24;
 * H:4833–4835; `patient-file.md:158–169`): 560px, "Add package" over the
 * patient's name; one titled group "Pick a package" — the multi-session offerings as
 * chips, "LHR Full Face · 7s · ₹4,800"; the summary "Sessions are counted
 * when a treatment is completed". None picked → "Pick a package"; else the
 * package is added with no invoice yet (AMBER A-F6, an Appendix F request)
 * and "Package added · invoice it from Invoices".
 */
export function AddPackageDrawer({
  patientId,
  patientName,
  onClose,
}: AddPackageDrawerProps) {
  const { t } = useTranslation(PACKAGE_NS);
  const offerings = usePackageOfferings();
  const add = useAddPatientPackage({ notifyOnError: false });
  const form = useForm<AddPackageValues>({ defaultValues: { offeringId: null } });
  const values = useFormValues(form);
  const { isDirty } = useFormState({ control: form.control });

  const { saveState, save } = useDrawerSave<AddPackageValues, unknown>({
    form,
    fieldOrder: ['offeringId'],
    toastId: 'package-save-failed',
    check: ({ offeringId }) =>
      offeringId ? null : { fields: ['offeringId'], message: t(K.noPick) },
    onField: () => undefined,
    write: () =>
      add.mutateAsync({ patientId, offeringId: form.getValues('offeringId') ?? '' }),
    onDone: () => {
      notify.success(t(K.added));
      onClose();
    },
  });

  return (
    <RecordDrawer
      open
      onClose={onClose}
      title={t(K.title)}
      sub={patientName}
      // 560px as drawn (H:4835): one wrapping row of chips.
      content={{ fieldCount: 1 }}
      tone="sage"
      summary={t(K.summary)}
      saveLabel={t(K.save)}
      onSave={() => void save()}
      saveState={saveState}
      dirty={isDirty}
      testId={PACKAGE_TEST_ID}
    >
      {/* One titled group, no step card — the drawer's only section (H:4833). */}
      <DrawerFieldGrid title={t(K.step)}>
        <DrawerField span="full">
          <PackageChips
            offerings={offerings.data}
            value={values.offeringId}
            onChange={(offeringId) =>
              form.setValue('offeringId', offeringId, { shouldDirty: true })
            }
          />
        </DrawerField>
      </DrawerFieldGrid>
    </RecordDrawer>
  );
}
