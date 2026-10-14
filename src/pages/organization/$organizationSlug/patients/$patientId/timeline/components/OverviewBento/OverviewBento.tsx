import { useParams } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import {
  organizationPatientSection,
  organizationTreatmentEdit,
} from '@/lib/routes/patient-file-builders.ts';
import { cn } from '@/lib/utils.ts';
import type { InvoiceRecord } from '@/shared/api/app/invoices-contracts.ts';
import type { PatientPhotoAlbum } from '@/shared/api/app/patient-images-contracts.ts';
import { appCommandNavigation } from '@/shared/app/app-command-targets.ts';
import type { PatientFileSectionSlug } from '@/shared/app/patient-file-sections.ts';
import { useAppAccess } from '@/shared/hooks/useAppAccess/index.ts';
import { useAppNavigate } from '@/shared/hooks/useAppNavigate/index.ts';
import { useContactActivityAccess } from '@/shared/hooks/useContactActivities/index.ts';
import { usePaymentAccess } from '@/shared/hooks/usePaymentAccess/index.ts';

import { useClinicalLists } from '../../../shared/hooks/useClinicalLists/index.ts';
import {
  type PatientAddItemId,
  usePatientFileActions,
} from '../../../shared/hooks/usePatientFileActions/index.ts';
import { usePatientFileContext } from '../../../shared/patient-file-context.ts';
import {
  TIMELINE_KEYS,
  TIMELINE_NS,
  TIMELINE_TEST_IDS,
} from '../../timeline.constants.ts';
import { BillingBentoCard } from './bento-billing.tsx';
import {
  PackagesBentoCard,
  PrescriptionsBentoCard,
  TreatmentsBentoCard,
  VisitsBentoCard,
} from './bento-care.tsx';
import { ClinicalBentoCard } from './bento-clinical.tsx';
import { NotesBentoCard, PhotosBentoCard, ReportsBentoCard } from './bento-files.tsx';
import { useSmartNote } from './use-smart-note.ts';

/**
 * Each row's grid by how many of its cards the member sees — full literals, so
 * Tailwind sees every class; the content column is the container (`@container`
 * on the section's scroller).
 */
const CARE_ROW: Readonly<Record<number, string>> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 @min-[560px]:grid-cols-2',
  3: 'grid-cols-1 @min-[760px]:grid-cols-3',
  4: 'grid-cols-1 @min-[560px]:grid-cols-2 @min-[1180px]:grid-cols-4',
};
const PAIR_ROW: Readonly<Record<number, string>> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 @min-[640px]:grid-cols-2',
};

/** One row of the Overview: its cards side by side, each the row's height. */
function OverviewRow({
  name,
  cells,
  className,
}: {
  /** The row's `data-row` — `care`, `files`, `money`. */
  name: string;
  cells: readonly ReactNode[];
  className: string;
}) {
  if (cells.length === 0) return null;
  return (
    <div
      data-testid={TIMELINE_TEST_IDS.row(name)}
      className={cn('grid items-stretch gap-3', className)}
    >
      {cells}
    </div>
  );
}

/** What every row needs: what the member sees, what each card opens and adds. */
function useBentoLinks() {
  const { t } = useTranslation(TIMELINE_NS);
  const navigate = useAppNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const { patientId, viewable } = usePatientFileContext();
  const access = useAppAccess();
  const money = usePaymentAccess();
  const { items, reschedule } = usePatientFileActions();
  const can = (area: 'patients' | 'appointments', action: 'create' | 'edit') =>
    access.isResolved && access.can(area, action);
  const run = (id: PatientAddItemId) => items.find((item) => item.id === id)?.run ?? null;
  const shows = (section: PatientFileSectionSlug) => viewable.includes(section);
  const canBook = can('appointments', 'create');
  return {
    can,
    run,
    shows,
    newOf: (id: PatientAddItemId, label: string) => {
      const action = run(id);
      return action ? { label: t(label), run: action } : null;
    },
    open: (section: PatientFileSectionSlug) =>
      shows(section)
        ? () =>
            void navigate(
              organizationPatientSection(organizationSlug, patientId, section),
            )
        : null,
    book: canBook ? run('appointment') : null,
    reschedule: canBook ? reschedule : null,
    editTreatment: (treatmentId: string) =>
      void navigate(organizationTreatmentEdit(organizationSlug, patientId, treatmentId)),
    openAlbum: (album: PatientPhotoAlbum) =>
      void navigate({
        ...organizationPatientSection(organizationSlug, patientId, 'images'),
        search: album === 'general' ? {} : { album },
      }),
    openInvoice: (invoice: InvoiceRecord) => {
      const editable = money.canEdit && invoice.type !== 'medical' && !invoice.isSettled;
      void navigate(
        appCommandNavigation(editable ? 'invoiceEdit' : 'invoice', {
          organizationSlug,
          recordId: invoice.id,
          referrer: `patients/${patientId}/timeline`,
        }),
      );
    },
  };
}

/** {@link useBentoLinks}' answer, as the rows read it. */
type BentoLinks = ReturnType<typeof useBentoLinks>;

/** Care: Visits, Treatments, Packages, Prescriptions — the ones the member reads. */
function CareRow({ links }: { links: BentoLinks }) {
  const cells = [
    links.shows('visits') ? (
      <VisitsBentoCard
        key="visits"
        onOpen={links.open('visits')}
        onBook={links.book}
        onReschedule={links.reschedule}
      />
    ) : null,
    links.shows('treatments') ? (
      <TreatmentsBentoCard
        key="treatments"
        onOpen={links.open('treatments')}
        onNew={links.newOf('treatment', TIMELINE_KEYS.treatments.new)}
        onEdit={links.editTreatment}
      />
    ) : null,
    links.shows('packages') ? (
      <PackagesBentoCard key="packages" onOpen={links.open('packages')} />
    ) : null,
    links.shows('prescriptions') ? (
      <PrescriptionsBentoCard
        key="prescriptions"
        onOpen={links.open('prescriptions')}
        onNew={links.newOf('prescription', TIMELINE_KEYS.prescriptions.new)}
      />
    ) : null,
  ].filter(Boolean);
  return (
    <OverviewRow name="care" cells={cells} className={CARE_ROW[cells.length] ?? ''} />
  );
}

/** Photos (two thirds) and Reports (one third) from 900px. */
function FilesRow({ links }: { links: BentoLinks }) {
  const reports = links.shows('reports');
  const cells = [
    links.shows('images') ? (
      <PhotosBentoCard
        key="photos"
        onOpen={links.open('images')}
        onUpload={links.run('photo')}
        onAlbum={links.openAlbum}
        className={reports ? '@min-[900px]:col-span-2' : undefined}
      />
    ) : null,
    reports ? (
      <ReportsBentoCard
        key="reports"
        onOpen={links.open('reports')}
        onNew={links.newOf('report', TIMELINE_KEYS.reports.new)}
      />
    ) : null,
  ].filter(Boolean);
  return (
    <OverviewRow
      name="files"
      cells={cells}
      className={
        cells.length === 2 ? 'grid-cols-1 @min-[900px]:grid-cols-3' : 'grid-cols-1'
      }
    />
  );
}

/** Billing (billing view) and Team notes (`contact_activity:read`). */
function MoneyRow({ links }: { links: BentoLinks }) {
  const stream = useContactActivityAccess();
  const cells = [
    links.shows('invoices') ? (
      <BillingBentoCard
        key="billing"
        onOpen={links.open('invoices')}
        onNew={links.newOf('invoice', TIMELINE_KEYS.billing.new)}
        onInvoice={links.openInvoice}
        onCollect={links.run('payment')}
      />
    ) : null,
    stream.reads ? (
      <NotesBentoCard key="notes" onOpen={links.open('notes')} canPost={stream.writes} />
    ) : null,
  ].filter(Boolean);
  return (
    <OverviewRow name="money" cells={cells} className={PAIR_ROW[cells.length] ?? ''} />
  );
}

/**
 * The Overview's records (KICKOFF §6.6 Overview, D19; H:769–779, H:4980–4999),
 * in fixed rows (change-patient-overview-photos D9) — every card in a row one
 * height, so nothing leaves a hole: Clinical (with the smart note) the full
 * width; Care — Visits, Treatments, Packages, Prescriptions — one column, two
 * from 560px of the content column, four from 1180px; Photos (two thirds) and
 * Reports (one third) from 900px; Billing and Team notes side by side from
 * 640px. A card shows only for a member whose codes read it (its section's —
 * billing view for Billing — `contact_activity:read` for Team notes), so no
 * read is refused, and a row closes up around the cards it has; each opens its
 * section and adds its record through the file's Add-to-record items, for the
 * member who may. A Billing invoice opens Edit invoice for a member who may
 * change it (`payment:update`, never a sale's or a settled one's), else its
 * preview, over the file (`from`, A-P1).
 */
export function OverviewBento() {
  const { file } = usePatientFileContext();
  const links = useBentoLinks();
  const lists = useClinicalLists(file?.patient);
  const smart = useSmartNote(lists);
  return (
    <div data-testid={TIMELINE_TEST_IDS.bento} className="flex flex-col gap-3">
      <ClinicalBentoCard
        lists={lists}
        smart={links.can('patients', 'edit') ? smart : null}
        onOpen={links.open('overview')}
      />
      <CareRow links={links} />
      <FilesRow links={links} />
      <MoneyRow links={links} />
    </div>
  );
}
