import { useNavigate, useParams } from '@tanstack/react-router';
import type { CSSProperties } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { PatientPackageRow } from '@/shared/api/clinic/patient-packages-api.ts';
import { patientName } from '@/shared/api/clinic/patients-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { clinicCommandNavigation } from '@/shared/clinic/clinic-command-targets.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { usePatientPackages } from '@/shared/hooks/usePatientPackages/index.ts';

import {
  PATIENT_SECTION_KEYS,
  PATIENT_SECTION_NS,
  PatientSection,
} from '../shared/components/PatientSection/index.ts';
import { useTableDay } from '../shared/components/PatientSectionTable/index.ts';
import { usePackageSession } from '../shared/hooks/usePackageSession/index.ts';
import { usePatientFileContext } from '../shared/patient-file-context.ts';
import { AddPackageDrawer } from './components/AddPackageDrawer/index.ts';
import { PACKAGE_CARD_TEST_ID, PACKAGE_KEYS, PACKAGE_NS } from './packages.constants.ts';
import { manifest } from './packages.manifest.ts';

const K = PACKAGE_KEYS.card;

/**
 * One package (H:833): its name on a 24px pill in the offering's tone, "6
 * left" over "1 of 7 used", the 6px bar in the tone's ink, "Valid till 24 Sep
 * 2027 · Next: 8 Oct", then "Use a session" and "Book next" — each for the
 * member it is for.
 */
function PackageCard({
  row,
  onUse,
  onBook,
}: {
  row: PatientPackageRow;
  onUse: (() => void) | null;
  onBook: (() => void) | null;
}) {
  const { t } = useTranslation([PACKAGE_NS, CLINIC_NS]);
  const day = useTableDay();
  const { sessionsTotal: total, sessionsUsed: used, validUntil } = row.package;
  const tone = row.offering?.tone ?? 'lav';
  const percent = total > 0 ? Math.round((used / total) * 100) : 0;
  const testId = `${PACKAGE_CARD_TEST_ID}-${row.package.id}`;
  const dates = [
    t(K.validTill, { date: day(validUntil) }),
    ...(row.nextVisit ? [t(K.next, { date: day(row.nextVisit, true) })] : []),
  ].join(' · ');

  return (
    <div
      data-slot="card"
      data-testid={testId}
      className="bg-card flex flex-col gap-2.5 rounded-xl border p-3.5"
    >
      <span
        data-slot="pill"
        className={cn(
          'text-caption flex h-6 max-w-full items-center truncate rounded-full px-2.5 font-medium tabular-nums',
          TONE_CLASSES[tone].surface,
        )}
      >
        {row.offering?.name ??
          t(CLINIC_KEYS.offerings.categories.package, { ns: CLINIC_NS })}
      </span>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-lg font-semibold tabular-nums">
          {t(K.left, { count: Math.max(0, total - used) })}
        </span>
        <span className="text-caption text-muted-foreground tabular-nums">
          {t(K.used, { used, total })}
        </span>
      </div>
      <span
        aria-hidden="true"
        data-slot="pill"
        className="bg-muted block h-1.5 overflow-hidden rounded-full"
      >
        <span
          data-slot="pill"
          className={cn('block h-full w-(--fill) rounded-full', TONE_CLASSES[tone].fill)}
          style={{ '--fill': `${percent}%` } as CSSProperties}
        />
      </span>
      <span className="text-caption text-muted-foreground-strong">{dates}</span>
      {onUse || onBook ? (
        <div className="flex gap-1.5">
          {onUse ? (
            <Button
              type="button"
              onClick={onUse}
              data-testid={`${testId}-use`}
              className="text-detail h-8 flex-1 rounded-lg"
            >
              {t(K.use)}
            </Button>
          ) : null}
          {onBook ? (
            <Button
              type="button"
              variant="outline"
              onClick={onBook}
              data-testid={`${testId}-book`}
              className="text-detail h-8 flex-1 rounded-lg"
            >
              {t(K.book)}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Patient file › Packages (KICKOFF §6.6; H:833; `patient-file.md:70–79`): the
 * patient's packages as cards, `repeat(auto-fill, minmax(280px, 1fr))` — one
 * per row on a phone, two from 572px of content — or "No packages yet".
 * "Use a session" counts one by hand ("Session 2 of 7 used"; the contract
 * counts sessions only through treatments — backend request) and "Book next"
 * opens the appointment form for this patient. "Add package" opens its
 * drawer as component state (no route, D24); adding one writes to the
 * patient (`patients.create`).
 */
export function PatientPackagesPage() {
  const { t } = useTranslation([PATIENT_SECTION_NS, PACKAGE_NS]);
  const navigate = useNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const { patientId, file } = usePatientFileContext();
  const access = useClinicAccess();
  const packages = usePatientPackages(patientId);
  const [adding, setAdding] = useState(false);
  const canAdd = access.isResolved && access.can('patients', 'create');
  const canUse = access.isResolved && access.can('patients', 'edit');
  const canBook = access.isResolved && access.can('appointments', 'create');
  const rows = packages.data ?? [];

  const takeSession = usePackageSession();
  const book = () =>
    void navigate(
      clinicCommandNavigation('newAppointment', {
        organizationSlug,
        referrer: `patients/${patientId}/packages`,
        search: { who: patientId },
      }),
    );

  return (
    <>
      <PatientSection
        section="packages"
        data-testid={manifest.testId}
        primary={
          canAdd
            ? {
                label: t(PATIENT_SECTION_KEYS.primary.packages),
                onSelect: () => setAdding(true),
              }
            : null
        }
      >
        <div className="px-(--table-pad-x) pt-3 pb-5">
          {rows.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
              {rows.map((row) => (
                <PackageCard
                  key={row.package.id}
                  row={row}
                  onUse={canUse ? () => takeSession(row) : null}
                  onBook={canBook ? book : null}
                />
              ))}
            </div>
          ) : null}
          {packages.isSuccess && rows.length === 0 ? (
            <p className="text-body text-muted-foreground p-10 text-center">
              {t(K.empty, { ns: PACKAGE_NS })}
            </p>
          ) : null}
        </div>
      </PatientSection>
      {adding && file ? (
        <AddPackageDrawer
          patientId={patientId}
          patientName={patientName(file.patient)}
          onClose={() => setAdding(false)}
        />
      ) : null}
    </>
  );
}
