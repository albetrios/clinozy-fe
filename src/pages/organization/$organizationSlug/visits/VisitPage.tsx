import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { organizationPatientSection } from '@/lib/routes/patient-file-builders.ts';
import { fetchVisit, visitQueryKeys } from '@/shared/api/clinic/visits-api.ts';
import { CLINIC_SECTION_ROUTES } from '@/shared/clinic/clinic-home.ts';
import { canUseVisitTab, type VisitTab } from '@/shared/clinic/visit-access.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useDialogRouteRecord } from '@/shared/hooks/useDialogRouteRecord/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { VisitSheet } from './components/VisitSheet/index.ts';
import { VISIT_KEYS, VISIT_NS, VISIT_TABS } from './visits.constants.ts';
import { validateVisitSearch } from './visits.search.ts';

/**
 * The Visit sheet's page (`/visits/$visitId`; KICKOFF §6.13, D18): the visit
 * read by its id — an unknown one goes back to Today with "Visit not found ·
 * it may have been deleted" (`S:115`) — and the tabs the member may use, each
 * from the record it writes (`canUseVisitTab`); a member with none goes back
 * with the permission toast. `?tab=` picks the tab (History by default); a tab
 * the member can't use shows their first one. Closing goes to Today.
 */
export function VisitPage() {
  const { t } = useTranslation([VISIT_NS, ERRORS_NS]);
  const navigate = useNavigate();
  const { organizationSlug = '', visitId } = useParams({ strict: false });
  // The route keeps the raw values (its search is typed only); parsed here.
  const search = validateVisitSearch(useSearch({ strict: false }));
  const access = useClinicAccess();
  const left = useRef(false);

  const toToday = useCallback(() => {
    if (left.current) return;
    left.current = true;
    void navigate({ to: CLINIC_SECTION_ROUTES.today, params: { organizationSlug } });
  }, [navigate, organizationSlug]);

  const route = useDialogRouteRecord({
    id: visitId,
    queryKey: visitQueryKeys.detail,
    fetchRecord: fetchVisit,
    recordLabel: t(VISIT_KEYS.record),
    onMissing: toToday,
  });

  const tabs: VisitTab[] = access.isResolved
    ? VISIT_TABS.filter((tab) => canUseVisitTab(tab, access))
    : [];
  const refused = access.isResolved && tabs.length === 0;

  useEffect(() => {
    if (!refused) return;
    notify.error(t(ERRORS_KEYS.route.forbidden, { ns: ERRORS_NS }));
    toToday();
  }, [refused, t, toToday]);

  if (!route.isOpen || refused) return null;

  const requested = search.tab ?? 'timeline';
  const tab = tabs.includes(requested) ? requested : (tabs[0] ?? requested);
  const patientId = route.record?.person.patientId ?? null;

  return (
    <VisitSheet
      detail={route.record ?? null}
      failed={route.isError}
      onRetry={route.refetch}
      tab={tab}
      tabs={tabs}
      onTab={(next) =>
        void navigate({
          to: '.',
          search: next === 'timeline' ? {} : { tab: next },
          hash: true,
          replace: true,
        })
      }
      onClose={toToday}
      onProfile={
        patientId
          ? () => {
              left.current = true;
              void navigate(
                organizationPatientSection(organizationSlug, patientId, 'timeline'),
              );
            }
          : undefined
      }
    />
  );
}
