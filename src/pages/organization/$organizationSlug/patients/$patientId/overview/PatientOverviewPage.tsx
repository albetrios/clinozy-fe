import { useNavigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { organizationLead } from '@/lib/routes/leads-builders.ts';
import {
  organizationCheckInEdit,
  organizationReviewEdit,
} from '@/lib/routes/patient-file-builders.ts';
import type { FeedbackItem } from '@/shared/api/clinic/feedback-contracts.ts';
import { patientName } from '@/shared/api/clinic/patients-contracts.ts';
import {
  OfferingSuggestions,
  usePlanCard,
} from '@/shared/components/OfferingSuggestions/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';

import { PatientSection } from '../shared/components/PatientSection/index.ts';
import { useClinicalLists } from '../shared/hooks/useClinicalLists/index.ts';
import { CLINICAL_LISTS } from '../shared/patient-clinical.ts';
import { usePatientFileContext } from '../shared/patient-file-context.ts';
import { ClinicalChipCard } from './components/ClinicalChipCard/index.ts';
import { FeedbackCard } from './components/FeedbackCard/index.ts';
import { LogFeedbackPicker } from './components/LogFeedbackPicker/index.ts';
import { CLINICAL_KEYS, CLINICAL_NS, OVERVIEW_TEST_IDS } from './overview.constants.ts';
import { manifest } from './overview.manifest.ts';

/** Where a suggestion added from the file is made (`OfferingSuggestion.source`, `S:487`). */
const PLAN_SOURCE = 'Patient file';

/**
 * Patient file › Clinical notes (KICKOFF §6.6; H:780–826;
 * `patient-file.md:48–57`): a 12-column grid that measures its own width —
 * the four chip cards span it, then half from 620px, then a quarter from
 * 980px (`@container`, F8) — over Offering suggestions and Feedback, both
 * collapsed at first. Patients edit writes the notes and logs feedback; the
 * check-in and review drawers open over this section by their routes.
 */
export function PatientOverviewPage() {
  const { t } = useTranslation(CLINICAL_NS);
  const { organizationSlug = '' } = useParams({ strict: false });
  const navigate = useNavigate();
  const { patientId, file } = usePatientFileContext();
  const access = useClinicAccess();
  const canEdit = access.isResolved && access.can('patients', 'edit');
  const lists = useClinicalLists(file?.patient);
  const [pricesShown, setPricesShown] = useState(false);
  const [logging, setLogging] = useState(false);
  const plan = usePlanCard({
    patientId: file ? patientId : '',
    firstName: file?.patient.firstName ?? '',
    sourceLabel: PLAN_SOURCE,
    appointmentId: null,
    canEdit,
    onOpenChat: (leadId) => void navigate(organizationLead(organizationSlug, leadId)),
  });

  const edit = (item: FeedbackItem) =>
    void navigate({
      ...(item.kind === 'checkIn'
        ? organizationCheckInEdit(organizationSlug, patientId, item.id)
        : organizationReviewEdit(organizationSlug, patientId, item.id)),
      search: { from: 'overview' },
    });

  return (
    <PatientSection section="overview" data-testid={manifest.testId}>
      <div className="@container grid grid-cols-12 gap-2.5 px-(--table-pad-x) pt-3 pb-(--table-pad-x)">
        {CLINICAL_LISTS.map(({ field, tone }) => (
          <ClinicalChipCard
            key={field}
            title={t(CLINICAL_KEYS.titles[field])}
            tone={tone}
            items={lists.items(field)}
            fresh={lists.fresh(field)}
            onAdd={(text) => lists.add(field, text)}
            onRemove={(text) => lists.remove(field, text)}
            canEdit={canEdit && Boolean(file)}
            testId={OVERVIEW_TEST_IDS.chipCard(field)}
            className="col-span-12 @min-[620px]:col-span-6 @min-[980px]:col-span-3"
          />
        ))}
        <div className="col-span-12 flex min-w-0 flex-col gap-2.5">
          {plan.props ? (
            <OfferingSuggestions
              variant="file"
              pricesShown={pricesShown}
              onPricesShownChange={setPricesShown}
              {...plan.props}
            />
          ) : null}
          <FeedbackCard
            patientId={patientId}
            canEdit={canEdit}
            onLog={() => setLogging(true)}
            onEdit={edit}
          />
        </div>
      </div>
      {logging && file ? (
        <LogFeedbackPicker
          patientId={patientId}
          patientName={patientName(file.patient)}
          from="overview"
          onClose={() => setLogging(false)}
        />
      ) : null}
    </PatientSection>
  );
}
