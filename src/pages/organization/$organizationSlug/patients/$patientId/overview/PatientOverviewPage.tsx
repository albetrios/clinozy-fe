import { useNavigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
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
import { RetryError } from '@/shared/components/RetryError/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { PatientSection } from '../shared/components/PatientSection/index.ts';
import { useClinicalLists } from '../shared/hooks/useClinicalLists/index.ts';
import { CLINICAL_LISTS, type ClinicalChip } from '../shared/patient-clinical.ts';
import { usePatientFileContext } from '../shared/patient-file-context.ts';
import { ClinicalChipCard } from './components/ClinicalChipCard/index.ts';
import { FeedbackCard } from './components/FeedbackCard/index.ts';
import { LogFeedbackPicker } from './components/LogFeedbackPicker/index.ts';
import { CLINICAL_KEYS, CLINICAL_NS, OVERVIEW_TEST_IDS } from './overview.constants.ts';
import { manifest } from './overview.manifest.ts';

/**
 * The plan card on the file's patient (Offering suggestions): idle until the file is read; its
 * chat link opens the patient's lead.
 */
function useFilePlanCard(canEdit: boolean) {
  const { organizationSlug = '' } = useParams({ strict: false });
  const navigate = useNavigate();
  const { patientId, file } = usePatientFileContext();
  return usePlanCard({
    patientId: file ? patientId : '',
    contactId: file?.patient.contactId ?? null,
    leadId: file?.patient.leadId ?? null,
    firstName: file?.patient.firstName ?? '',
    canEdit,
    onOpenChat: (leadId) => void navigate(organizationLead(organizationSlug, leadId)),
  });
}

/**
 * Patient file › Clinical notes (KICKOFF §6.6; H:780–826;
 * `patient-file.md:48–57`): a 12-column grid that measures its own width —
 * the four chip cards span it, then half from 620px, then a quarter from
 * 980px (`@container`, F8) — over Offering suggestions and Feedback, both
 * collapsed at first. Each chip is a clinical note (api-integration §5.4):
 * Patients edit adds one per chip and removes one with "<chip> removed" and
 * Undo (Q24), and logs feedback; the check-in and review drawers open over
 * this section by their routes. The notes' failed read stands in for the
 * four cards, with Retry.
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
  const plan = useFilePlanCard(canEdit);

  const removeChip = async (chip: ClinicalChip) => {
    if (!(await lists.remove(chip))) return;
    notify.undo(t(CLINICAL_KEYS.removed, { name: chip.text }), {
      onUndo: () => lists.restore(chip),
    });
  };

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
        {lists.isError ? (
          <div data-slot="card" className="bg-card col-span-12 rounded-xl border">
            <RetryError
              message={t(ERRORS_KEYS.frontend.query.loadFailed, { ns: ERRORS_NS })}
              onRetry={lists.retry}
            />
          </div>
        ) : (
          CLINICAL_LISTS.map(({ field, tone }) => (
            <ClinicalChipCard
              key={field}
              title={t(CLINICAL_KEYS.titles[field])}
              tone={tone}
              items={lists.items(field)}
              loading={lists.isLoading}
              onAdd={(text) => lists.add(field, text)}
              onRemove={(chip) => void removeChip(chip)}
              canEdit={canEdit && Boolean(file)}
              testId={OVERVIEW_TEST_IDS.chipCard(field)}
              className="col-span-12 @min-[620px]:col-span-6 @min-[980px]:col-span-3"
            />
          ))
        )}
        <div className="col-span-12 flex min-w-0 flex-col gap-2.5">
          {plan.status === 'error' ? (
            <div data-slot="card" className="bg-card rounded-xl border">
              <RetryError
                message={t(ERRORS_KEYS.frontend.query.loadFailed, { ns: ERRORS_NS })}
                onRetry={plan.retry}
              />
            </div>
          ) : null}
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
