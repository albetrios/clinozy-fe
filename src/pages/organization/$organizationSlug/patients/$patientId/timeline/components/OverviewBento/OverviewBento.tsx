import { useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import {
  organizationPatientSection,
  organizationTreatmentEdit,
} from '@/lib/routes/patient-file-builders.ts';
import type { PatientFileSectionSlug } from '@/shared/clinic/patient-file-sections.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useClinicNavigate } from '@/shared/hooks/useClinicNavigate/index.ts';
import { useContactActivityAccess } from '@/shared/hooks/useContactActivities/index.ts';

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
 * The Overview's bento (KICKOFF §6.6 Overview, D19; H:769–779, H:4980–4999):
 * Clinical (with the smart note), Visits, Photos, Packages, Prescriptions,
 * Treatments, Reports and Team notes — one column, two from 640px of the
 * content column, three from 1100px (container variants on the column, row
 * dense; the prototype estimates the width from the viewport, H:4923),
 * Clinical, Photos and Team notes two columns wide. A card shows only for a
 * member whose codes read it (its section's, `contact_activity:read` for Team
 * notes), so no read is refused; each opens its section and adds its record
 * through the file's Add-to-record items, for the member who may. Billing
 * comes back with Payments on clinozy-be: its invoices and payments are still
 * the fixture world's, and the file has no dues read (G4).
 */
export function OverviewBento() {
  const { t } = useTranslation(TIMELINE_NS);
  const navigate = useClinicNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const { patientId, file, viewable } = usePatientFileContext();
  const access = useClinicAccess();
  const stream = useContactActivityAccess();
  const { items, reschedule } = usePatientFileActions();
  const lists = useClinicalLists(file?.patient);
  const smart = useSmartNote(lists);
  const can = (area: 'patients' | 'appointments', action: 'create' | 'edit') =>
    access.isResolved && access.can(area, action);
  const run = (id: PatientAddItemId) => items.find((item) => item.id === id)?.run ?? null;
  const newOf = (id: PatientAddItemId, label: string) => {
    const action = run(id);
    return action ? { label: t(label), run: action } : null;
  };
  const shows = (section: PatientFileSectionSlug) => viewable.includes(section);
  const open = (section: PatientFileSectionSlug) =>
    shows(section)
      ? () =>
          void navigate(organizationPatientSection(organizationSlug, patientId, section))
      : null;
  const canBook = can('appointments', 'create');

  return (
    <div
      data-testid={TIMELINE_TEST_IDS.bento}
      className="grid grid-flow-row-dense grid-cols-1 items-start gap-3 @min-[640px]:grid-cols-2 @min-[1100px]:grid-cols-3"
    >
      <ClinicalBentoCard
        lists={lists}
        smart={can('patients', 'edit') ? smart : null}
        onOpen={open('overview')}
      />
      {shows('visits') ? (
        <VisitsBentoCard
          onOpen={open('visits')}
          onBook={canBook ? run('appointment') : null}
          onReschedule={canBook ? reschedule : null}
        />
      ) : null}
      {shows('images') ? (
        <PhotosBentoCard
          onOpen={open('images')}
          onUpload={run('photo')}
          onAlbum={(album) =>
            void navigate({
              ...organizationPatientSection(organizationSlug, patientId, 'images'),
              search: album === 'general' ? {} : { album },
            })
          }
        />
      ) : null}
      {shows('packages') ? <PackagesBentoCard onOpen={open('packages')} /> : null}
      {shows('prescriptions') ? (
        <PrescriptionsBentoCard
          onOpen={open('prescriptions')}
          onNew={newOf('prescription', TIMELINE_KEYS.prescriptions.new)}
        />
      ) : null}
      {shows('treatments') ? (
        <TreatmentsBentoCard
          onOpen={open('treatments')}
          onNew={newOf('treatment', TIMELINE_KEYS.treatments.new)}
          onEdit={(treatmentId) =>
            void navigate(
              organizationTreatmentEdit(organizationSlug, patientId, treatmentId),
            )
          }
        />
      ) : null}
      {shows('reports') ? (
        <ReportsBentoCard
          onOpen={open('reports')}
          onNew={newOf('report', TIMELINE_KEYS.reports.new)}
        />
      ) : null}
      {stream.reads ? (
        <NotesBentoCard onOpen={open('notes')} canPost={stream.writes} />
      ) : null}
    </div>
  );
}
