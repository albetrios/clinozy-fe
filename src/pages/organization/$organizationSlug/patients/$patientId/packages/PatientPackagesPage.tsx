import { useParams } from '@tanstack/react-router';
import type { CSSProperties } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';
import type {
  PatientPackageRow,
  PatientPackageStatus,
} from '@/shared/api/app/patient-packages-contracts.ts';
import { appCommandNavigation } from '@/shared/app/app-command-targets.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { TonePill } from '@/shared/components/Cells/index.ts';
import { EmptyState } from '@/shared/components/EmptyState/index.ts';
import { RetryError } from '@/shared/components/RetryError/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { Skeleton } from '@/shared/components/ui/skeleton.tsx';
import { useAppAccess } from '@/shared/hooks/useAppAccess/index.ts';
import { useAppNavigate } from '@/shared/hooks/useAppNavigate/index.ts';
import { usePatientPackages } from '@/shared/hooks/usePatientPackages/index.ts';
import { usePlanOfferings } from '@/shared/hooks/usePlan/index.ts';
import { Package } from '@/shared/icons/index.ts';

import { PatientSection } from '../shared/components/PatientSection/index.ts';
import { useTableDay } from '../shared/components/PatientSectionTable/index.ts';
import { usePatientFileContext } from '../shared/patient-file-context.ts';
import { EditPackageDrawer } from './components/EditPackageDrawer/index.ts';
import { PACKAGE_CARD_TEST_ID, PACKAGE_KEYS, PACKAGE_NS } from './packages.constants.ts';
import { manifest } from './packages.manifest.ts';

const K = PACKAGE_KEYS.card;

/** A package's name pill without its offering in the catalogue — the section's tone (mint). */
const FALLBACK_TONE: Tone = 'mint';

/** The status pill of a package past use: Used up stone, Expired butter. */
const STATUS_TONES: Readonly<Record<Exclude<PatientPackageStatus, 'active'>, Tone>> = {
  used_up: 'stone',
  expired: 'butter',
};

/**
 * One package (H:833): its name on a 24px pill in the offering's tone, "6
 * left" over "1 of 7 used", the 6px bar in the tone's ink, "Valid till 24 Sep
 * 2027" (or "No expiry") with "Used up" / "Expired" when the server says so,
 * then "Book next" and "Edit" — each for the member it is for. Every figure is
 * the server's (`sessions_left`, `sessions_used`, `status` — §7).
 */
function PackageCard({
  row,
  tone,
  onBook,
  onEdit,
}: {
  row: PatientPackageRow;
  tone: Tone;
  onBook: (() => void) | null;
  onEdit: (() => void) | null;
}) {
  const { t } = useTranslation(PACKAGE_NS);
  const day = useTableDay();
  const { sessionsTotal: total, sessionsUsed: used, sessionsLeft: left } = row;
  const percent = total > 0 ? Math.round((used / total) * 100) : 0;
  const testId = `${PACKAGE_CARD_TEST_ID}-${row.id}`;

  return (
    <div
      data-slot="card"
      data-testid={testId}
      data-status={row.status}
      className="bg-card flex flex-col gap-2.5 rounded-xl border p-3.5"
    >
      <span
        data-slot="pill"
        className={cn(
          'text-caption flex h-6 max-w-full items-center truncate rounded-full px-2.5 font-medium tabular-nums',
          TONE_CLASSES[tone].surface,
        )}
      >
        {row.name}
      </span>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-lg font-semibold tabular-nums">
          {t(K.left, { count: left })}
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
      <span className="text-caption text-muted-foreground-strong flex flex-wrap items-center gap-1.5">
        {row.validUntil ? t(K.validTill, { date: day(row.validUntil) }) : t(K.noExpiry)}
        {row.status === 'active' ? null : (
          <TonePill tone={STATUS_TONES[row.status]} size="xs">
            {t(K.statuses[row.status])}
          </TonePill>
        )}
      </span>
      {onBook || onEdit ? (
        <div className="flex gap-1.5">
          {onBook ? (
            <Button
              type="button"
              onClick={onBook}
              data-testid={`${testId}-book`}
              className="text-detail h-8 flex-1 rounded-lg"
            >
              {t(K.book)}
            </Button>
          ) : null}
          {onEdit ? (
            <Button
              type="button"
              variant="outline"
              onClick={onEdit}
              data-testid={`${testId}-edit`}
              className="text-detail h-8 flex-1 rounded-lg"
            >
              {t(K.edit)}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Two cards' outlines while the packages load. */
function PackageSkeletons() {
  return (
    <>
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
    </>
  );
}

/**
 * Patient file › Packages (KICKOFF §6.6; H:833; `patient-file.md:70–79`): the
 * patient's packages on clinozy-be (`GET …/offerings?is_package=true`) as
 * cards, `repeat(auto-fill, minmax(280px, 1fr))` — one per row on a phone, two
 * from 572px of content — or "No packages yet"; a failed read stands in with
 * Retry. "Book next" opens the appointment form for this person; "Edit"
 * (`payment:update`) opens Edit package as component state — its validity and
 * sessions (`PATCH …/offerings/:patient_offering_id`). The design's "Use a
 * session" goes — a recorded treatment spends one (§6 #20); "Add package"
 * goes — a package is bought only by invoicing it, and "Next" per package is
 * not served (G4).
 */
export function PatientPackagesPage() {
  const { t } = useTranslation([PACKAGE_NS, ERRORS_NS]);
  const navigate = useAppNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const { patientId, file } = usePatientFileContext();
  const access = useAppAccess();
  const packages = usePatientPackages(patientId);
  // The offerings' tones for the name pills — the plan card's catalogue read, shared.
  const offerings = usePlanOfferings();
  const [editingId, setEditingId] = useState<string | null>(null);
  const canBook =
    access.isResolved && access.can('appointments', 'create') && file !== undefined;
  const canEdit = access.canCode('payment:update');
  const rows = packages.data ?? [];
  const editing = rows.find((row) => row.id === editingId);
  const toneOf = (offeringId: string) =>
    offerings.data?.find((offering) => offering.id === offeringId)?.tone ?? FALLBACK_TONE;

  const book = () =>
    void navigate(
      appCommandNavigation('newAppointment', {
        organizationSlug,
        referrer: `patients/${patientId}/packages`,
        // The booking is the person's (`who=` a contact id).
        search: file ? { who: file.patient.contactId } : {},
      }),
    );

  return (
    <>
      <PatientSection section="packages" data-testid={manifest.testId}>
        <div className="flex min-h-full flex-col px-(--table-pad-x) pt-3 pb-5">
          {packages.isError ? (
            <RetryError
              message={t(ERRORS_KEYS.frontend.query.loadFailed, { ns: ERRORS_NS })}
              onRetry={() => void packages.refetch()}
              isRetrying={packages.isFetching}
            />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
              {packages.isPending ? <PackageSkeletons /> : null}
              {rows.map((row) => (
                <PackageCard
                  key={row.id}
                  row={row}
                  tone={toneOf(row.offeringId)}
                  // The next session of a package that has one left.
                  onBook={canBook && row.status === 'active' ? book : null}
                  onEdit={canEdit ? () => setEditingId(row.id) : null}
                />
              ))}
            </div>
          )}
          {packages.isSuccess && rows.length === 0 ? (
            // The room look in the Packages mint, centred (change-empty-states R19).
            <EmptyState tone="mint" icon={<Package />} title={t(K.empty)} />
          ) : null}
        </div>
      </PatientSection>
      {editing ? (
        <EditPackageDrawer
          // A reload that brings a newer package opens it afresh.
          key={editing.updatedAt}
          patientId={patientId}
          row={editing}
          onReload={() => void packages.refetch()}
          onClose={() => setEditingId(null)}
        />
      ) : null}
    </>
  );
}
