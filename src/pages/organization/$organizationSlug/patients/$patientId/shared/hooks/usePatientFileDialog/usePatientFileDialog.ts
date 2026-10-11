import { useLocation, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { organizationPatientSection } from '@/lib/routes/patient-file-builders.ts';
import {
  isPatientFileSection,
  type PatientFileSectionSlug,
} from '@/shared/app/patient-file-sections.ts';
import { notify } from '@/shared/notify/index.ts';

import { validatePatientFileDialogSearch } from '../../../patient-id.dialog-search.ts';

/** What a file-level dialog route reads (`edit/`, `check-ins/*`, `reviews/*`). */
export interface PatientFileDialog {
  /** The section it opened over: `?from=` when that names one, else Clinical notes (`S:34`, A-F1). */
  behind: PatientFileSectionSlug;
  /** Back to that section, replacing the dialog's URL. */
  back: () => void;
}

/**
 * A drawer route over the whole file rather than one section (KICKOFF §4;
 * `S:34, 44–47`): the section it shows behind itself, and the way back to it.
 * A member who may not open it (`canOpen` false; undefined while the access
 * loads) lands back on that section with the permission toast.
 */
export function usePatientFileDialog({
  canOpen,
}: { canOpen?: boolean } = {}): PatientFileDialog {
  const { organizationSlug = '', patientId = '' } = useParams({ strict: false });
  // The route keeps the raw values (its search is typed only); parsed here.
  const search = validatePatientFileDialogSearch(useSearch({ strict: false }));
  const pathname = useLocation({ select: (location) => location.pathname });
  const navigate = useNavigate();
  const { t } = useTranslation(ERRORS_NS);
  const behind = isPatientFileSection(search.from) ? search.from : 'overview';

  const back = useCallback(() => {
    void navigate({
      ...organizationPatientSection(organizationSlug, patientId, behind),
      hash: true,
      replace: true,
    });
  }, [navigate, organizationSlug, patientId, behind]);

  const refusedFor = useRef<string | null>(null);
  useEffect(() => {
    if (canOpen !== false || refusedFor.current === pathname) return;
    refusedFor.current = pathname;
    notify.info(t(ERRORS_KEYS.api.http403));
    back();
  }, [canOpen, pathname, back, t]);

  return { behind, back };
}
