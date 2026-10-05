import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { organizationPatientSection } from '@/lib/routes/patient-file-builders.ts';
import { SkeletonRows } from '@/shared/components/SkeletonRows/index.ts';
import { useOpenVisit } from '@/shared/hooks/useVisits/index.ts';

import type { PatientFileSearch } from '../patient-id.search.ts';
import { PatientSection } from '../shared/components/PatientSection/index.ts';
import { usePatientFileContext } from '../shared/patient-file-context.ts';
import { ActivityTimeline } from './components/ActivityTimeline/index.ts';
import { OverviewBento } from './components/OverviewBento/index.ts';
import { VisitFlow } from './components/VisitFlow/index.ts';
import {
  VISIT_FLOW_KEYS,
  VISIT_FLOW_NS,
} from './components/VisitFlow/visit-flow.constants.ts';
import { manifest } from './timeline.manifest.ts';

/**
 * `?visit=open` without an open visit drops the param and leaves the Overview
 * (KICKOFF §6.6: a deep link never starts a visit — navigation never mutates).
 */
function useDropStaleVisitParam(stale: boolean) {
  const navigate = useNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const { patientId } = usePatientFileContext();
  useEffect(() => {
    if (!stale) return;
    void navigate({
      ...organizationPatientSection(organizationSlug, patientId, 'timeline'),
      search: {},
      replace: true,
    });
  }, [stale, navigate, organizationSlug, patientId]);
}

/**
 * Patient file › Overview (KICKOFF §6.6, D19; H:769–779, H:4980–4999): the
 * default section, without a header (H:4943) — on the canvas, padding 16px
 * 20px 96px, the bento of the patient's records (one, two or three columns by
 * the content column's width: the scrolling column is the container, its
 * padding inside) and, after it, the activity timeline. On `?visit=open` the
 * visit flow takes its place while the patient has an open visit (L-49, D18).
 */
export function PatientTimelinePage() {
  const { t } = useTranslation(VISIT_FLOW_NS);
  const search: PatientFileSearch = useSearch({ strict: false });
  const { patientId } = usePatientFileContext();
  const wantsFlow = search.visit === 'open';
  const open = useOpenVisit(wantsFlow ? patientId : '');
  const visit = wantsFlow ? (open.data ?? null) : null;
  useDropStaleVisitParam(wantsFlow && open.isSuccess && visit === null);

  let body = (
    <div className="px-(--table-pad-x) pt-4 pb-24">
      <OverviewBento />
      <ActivityTimeline />
    </div>
  );
  if (visit) body = <VisitFlow visit={visit} />;
  else if (wantsFlow && open.isPending) {
    body = (
      <div className="px-(--table-pad-x) py-4">
        <SkeletonRows rows={5} label={t(VISIT_FLOW_KEYS.loading)} rowClassName="h-16" />
      </div>
    );
  }

  return (
    <PatientSection
      section="timeline"
      data-testid={manifest.testId}
      hideHeader
      className="bg-canvas @container"
    >
      {body}
    </PatientSection>
  );
}
