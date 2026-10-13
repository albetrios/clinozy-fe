import type { QueryKey } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams } from '@tanstack/react-router';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { organizationPatientSection } from '@/lib/routes/patient-file-builders.ts';
import { useDialogRouteRecord } from '@/shared/hooks/useDialogRouteRecord/index.ts';
import { notify } from '@/shared/notify/index.ts';

/** The sections whose records open as URL-driven dialogs over them (`S:35–43`). */
export type PatientRecordSection = 'prescriptions' | 'treatments' | 'reports';

/** The dialog a section's URL opens over it. */
export type PatientRecordMode = 'none' | 'create' | 'view' | 'edit';

/** What a section reads from its dialog routes. */
export interface PatientRecordRoute<T> {
  mode: PatientRecordMode;
  /** The record of a view or an edit, once loaded. */
  record: T | undefined;
  /** Back to the section, in place of the dialog's URL. */
  close: () => void;
}

/** Options of {@link usePatientRecordRoute}. */
export interface PatientRecordRouteOptions<T> {
  section: PatientRecordSection;
  /** The dialog route's id param; undefined on the section and its create route. */
  id: string | undefined;
  queryKey: (id: string) => QueryKey;
  fetchRecord: (id: string) => Promise<T>;
  /** The record's name in the not-found toast ("Prescription"). */
  recordLabel: string;
  /** Whether the member may create one — undefined while their access loads. */
  canCreate: boolean | undefined;
}

/**
 * Which dialog a patient-file section's URL opens over it (KICKOFF §4, D24;
 * `S:35–43`) — the dialog routes render nothing, so the section reads them
 * here: `<section>/create`, `<section>/$id` (a viewer), `<section>/$id/edit`.
 * A member without create who follows a create link lands back on the
 * section with the permission toast; an id that names no record goes back
 * with "<Record> not found · it may have been deleted". `close` returns to
 * the section, replacing the dialog's URL and keeping the hash.
 */
export function usePatientRecordRoute<T>({
  section,
  id,
  queryKey,
  fetchRecord,
  recordLabel,
  canCreate,
}: PatientRecordRouteOptions<T>): PatientRecordRoute<T> {
  const { organizationSlug = '', patientId = '' } = useParams({ strict: false });
  const pathname = useLocation({ select: (location) => location.pathname });
  const navigate = useNavigate();
  const { t } = useTranslation(ERRORS_NS);

  const close = useCallback(() => {
    void navigate({
      ...organizationPatientSection(organizationSlug, patientId, section),
      hash: true,
      replace: true,
    });
  }, [navigate, organizationSlug, patientId, section]);

  const record = useDialogRouteRecord({
    id,
    queryKey,
    fetchRecord,
    recordLabel,
    onMissing: close,
  });

  const isCreate = pathname.replace(/\/$/, '').endsWith(`/${section}/create`);
  const isEdit = id !== undefined && /\/edit\/?$/.test(pathname);
  let mode: PatientRecordMode = 'none';
  if (isCreate) mode = 'create';
  else if (id !== undefined && record.isOpen) mode = isEdit ? 'edit' : 'view';

  const refused = isCreate && canCreate === false;
  const refusedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!refused || refusedFor.current === pathname) return;
    refusedFor.current = pathname;
    notify.info(t(ERRORS_KEYS.api.http403));
    close();
  }, [refused, pathname, close, t]);

  return {
    mode: refused ? 'none' : mode,
    record: record.record,
    close,
  };
}
