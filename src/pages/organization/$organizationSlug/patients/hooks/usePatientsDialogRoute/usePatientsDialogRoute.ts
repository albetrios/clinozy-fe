import { useLocation, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { organizationPatients } from '@/lib/routes/patients-builders.ts';
import type { PatientDrawerPrefill } from '@/shared/components/PatientDrawer/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { validatePatientCreateSearch } from '../../patients.dialog-search.ts';
import { validatePatientsSearch } from '../../patients.search.ts';

/** The dialog the Patients URL opens over the list (KICKOFF §4, D24). */
export type PatientsDialogRoute =
  | { kind: 'none' }
  /** `/patients/create` — New patient, prefilled from `?name=&phone=&fromLead=` (`S:31`). */
  | { kind: 'create'; prefill: PatientDrawerPrefill };

/** The dialog, and how it closes: back to the list with the list's own params. */
export interface PatientsDialogRouteState {
  dialog: PatientsDialogRoute;
  close: () => void;
}

const CREATE_PATH = /\/patients\/create\/?$/;

/**
 * Which dialog the URL opens over the Patients list — the room's dialog route
 * renders nothing, so the page reads it here. A member without Create who
 * follows a create link lands back on the list with the permission toast.
 * `close` returns to the list with its view, search, filters and sort, and
 * nothing of the drawer's: the prefill's name and mobile leave the URL with it.
 */
export function usePatientsDialogRoute(): PatientsDialogRouteState {
  const { organizationSlug = '' } = useParams({ strict: false });
  const pathname = useLocation({ select: (location) => location.pathname });
  const search: Record<string, unknown> = useSearch({ strict: false });
  const navigate = useNavigate();
  const { t } = useTranslation(ERRORS_NS);
  const access = useClinicAccess();

  const close = useCallback(() => {
    void navigate({
      ...organizationPatients(organizationSlug),
      search: (current: Record<string, unknown>) => validatePatientsSearch(current),
      hash: true,
      replace: true,
    });
  }, [navigate, organizationSlug]);

  const isCreate = CREATE_PATH.test(pathname);
  const refused = isCreate && access.isResolved && !access.can('patients', 'create');
  const refusedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!refused || refusedFor.current === pathname) return;
    refusedFor.current = pathname;
    notify.info(t(ERRORS_KEYS.api.http403));
    close();
  }, [refused, pathname, close, t]);

  if (!isCreate || refused) return { dialog: { kind: 'none' }, close };
  // The prefill is parsed again here: from the list's own match the router
  // hands back the URL's raw values, not the create route's.
  const { name, phone, fromLead } = validatePatientCreateSearch(search);
  return {
    dialog: { kind: 'create', prefill: { name, phone, leadId: fromLead } },
    close,
  };
}
