import { useNavigate, useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { isolateText } from '@/lib/bidi-isolate.ts';
import {
  organizationCheckInCreate,
  organizationReviewCreate,
} from '@/lib/routes/patient-file-builders.ts';
import {
  REVIEW_SOURCE_VALUES,
  type ReviewSource,
} from '@/shared/api/clinic/clinic-schema.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { REVIEW_SOURCE_TONES } from '@/shared/clinic/clinic-tones.ts';
import type { PatientFileSectionSlug } from '@/shared/clinic/patient-file-sections.ts';
import {
  DrawerChips,
  DrawerField,
  DrawerFieldGrid,
} from '@/shared/components/DrawerField/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { usePatientTreatments } from '@/shared/hooks/useTreatments/index.ts';

import { usePatientFileContext } from '../../../shared/patient-file-context.ts';
import {
  CLINICAL_NS,
  LOG_FEEDBACK_KEYS,
  OVERVIEW_TEST_IDS,
} from '../../overview.constants.ts';
import type { FeedbackAccess } from '../FeedbackCard/index.ts';

const K = LOG_FEEDBACK_KEYS;
const ID = OVERVIEW_TEST_IDS.logFeedback;

/** How many recent sessions the picker offers aftercare check-ins for (H:4406). */
const RECENT_TREATMENTS = 4;

/** Each review source's line on hover (H:4406). */
const SOURCE_HINTS: Readonly<Record<ReviewSource, string>> = {
  google: K.hints.google,
  video: K.hints.video,
  instagram: K.hints.other,
  internal_form: K.hints.other,
  whatsapp: K.hints.other,
};

/** Props of {@link LogFeedbackPicker}. */
export interface LogFeedbackPickerProps {
  patientId: string;
  /** The patient's full name — the sub line. */
  patientName: string;
  /** The section it opened over — the drawer a chip opens keeps it behind (`?from=`). */
  from: PatientFileSectionSlug;
  /** What it may offer: check-ins (`patient:update`), reviews (`patient_review:create`, D83). */
  access: Pick<FeedbackAccess, 'checkIns' | 'logReview'>;
  onClose: () => void;
}

/**
 * Log feedback — component state, stacked, no route (KICKOFF §6.6 Drawers;
 * H:4406–4409; F10): 560px, "Log feedback" over "<name> · pick what you want
 * to record"; three groups of chips — "Check-in" (Consultation), "Treatment
 * feedback" (an aftercare check-in for each of the four latest treatments,
 * "After LHR Full Face" — for a member who may read treatments) and "Review"
 * (each source). A chip closes the picker and opens its drawer over the file;
 * "Close" closes it.
 */
export function LogFeedbackPicker({
  patientId,
  patientName,
  from,
  access,
  onClose,
}: LogFeedbackPickerProps) {
  const { t } = useTranslation([CLINICAL_NS, CLINIC_NS]);
  const { organizationSlug = '' } = useParams({ strict: false });
  const navigate = useNavigate();
  const { formatDate } = useLocaleFormat();
  const { viewable } = usePatientFileContext();
  // The Treatments section's read (`patient_treatment:read`); without it the group goes.
  // A reversed session is not followed up.
  const treatments = (
    usePatientTreatments(patientId, {
      enabled: access.checkIns && viewable.includes('treatments'),
      notifyOnError: false,
    }).data ?? []
  )
    .filter((treatment) => treatment.status === 'done')
    .slice(0, RECENT_TREATMENTS);

  const checkIn = (treatment?: string) => {
    onClose();
    void navigate({
      ...organizationCheckInCreate(organizationSlug, patientId),
      search: { from, ...(treatment ? { treatment } : {}) },
    });
  };
  const review = (source: ReviewSource) => {
    onClose();
    void navigate({
      ...organizationReviewCreate(organizationSlug, patientId),
      search: { from, source },
    });
  };

  return (
    <RecordDrawer
      open
      onClose={onClose}
      title={t(K.title)}
      sub={t(K.sub, { name: isolateText(patientName) })}
      // 560px as drawn (H:4406): rows of chips.
      content={{ fieldCount: 3 }}
      tone="sage"
      stacked
      saveLabel={t(K.close)}
      onSave={onClose}
      testId={ID}
    >
      {/* Titled groups 12px apart, no step cards (H:4406 `stepMode: 'off'`). */}
      <div className="flex flex-col gap-3">
        {access.checkIns ? (
          <DrawerFieldGrid title={t(K.groups.checkIn)}>
            <DrawerField span="full">
              <DrawerChips
                label={t(K.groups.checkIn)}
                options={[
                  {
                    value: 'visit',
                    label: t(K.consultation),
                    tone: 'sage',
                    hint: t(K.hints.consultation),
                  },
                ]}
                value={null}
                onChange={() => checkIn()}
                testId={`${ID}-check-in`}
              />
            </DrawerField>
          </DrawerFieldGrid>
        ) : null}
        {access.checkIns && treatments.length > 0 ? (
          <DrawerFieldGrid title={t(K.groups.treatment)}>
            <DrawerField span="full">
              <DrawerChips
                label={t(K.groups.treatment)}
                options={treatments.map((treatment) => ({
                  value: treatment.id,
                  label: t(K.after, { name: treatment.name }),
                  tone: 'mint',
                  hint: formatDate(treatment.performedAt, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  }),
                }))}
                value={null}
                onChange={(treatment) => checkIn(treatment ?? undefined)}
                testId={`${ID}-treatment`}
              />
            </DrawerField>
          </DrawerFieldGrid>
        ) : null}
        {access.logReview ? (
          <DrawerFieldGrid title={t(K.groups.review)}>
            <DrawerField span="full">
              <DrawerChips
                label={t(K.groups.review)}
                options={REVIEW_SOURCE_VALUES.map((source) => ({
                  value: source,
                  label: t(CLINIC_KEYS.reviewSources[source], { ns: CLINIC_NS }),
                  tone: REVIEW_SOURCE_TONES[source],
                  hint: t(SOURCE_HINTS[source]),
                }))}
                value={null}
                onChange={(source) => {
                  if (source) review(source);
                }}
                testId={`${ID}-review`}
              />
            </DrawerField>
          </DrawerFieldGrid>
        ) : null}
      </div>
    </RecordDrawer>
  );
}
