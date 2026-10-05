import { type QueryKey, useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { isHttpError } from '@/shared/errors/HttpError.ts';
import { notify } from '@/shared/notify/index.ts';

/** What a URL-driven drawer needs to know about its record. */
export interface DialogRouteRecord<T> {
  /** The record, once loaded. */
  record: T | undefined;
  /** The drawer should be open: the dialog route matched and the record exists (or is loading). */
  isOpen: boolean;
  isPending: boolean;
  /** The read failed for another reason than a missing record (a dropped connection, a 5xx). */
  isError: boolean;
  /** Read the record again — a failure's Retry. */
  refetch: () => void;
}

const isNotFound = (error: unknown) => isHttpError(error) && error.status === 404;

/**
 * The dialog-route deep-link pattern (KICKOFF §4, `S:115`). A URL-driven drawer
 * route renders nothing; its parent page passes the route's id here and opens
 * the drawer from the result. An id that matches no record — a stale link, a
 * deleted record — leaves the parent page behind with no drawer: one toast,
 * "<Record> not found · it may have been deleted", and `onMissing` (navigate
 * back to the parent, replacing the dead URL).
 */
export function useDialogRouteRecord<T>({
  id,
  queryKey,
  fetchRecord,
  recordLabel,
  onMissing,
}: {
  /** The dialog route's id param; undefined while the route is not matched. */
  id: string | undefined;
  queryKey: (id: string) => QueryKey;
  fetchRecord: (id: string) => Promise<T>;
  /** The record's name in the toast ("Lead", "Appointment"). */
  recordLabel: string;
  onMissing: () => void;
}): DialogRouteRecord<T> {
  const { t } = useTranslation(ERRORS_NS);
  const query = useQuery({
    queryKey: id === undefined ? ['dialog-route', 'none'] : queryKey(id),
    queryFn: () => fetchRecord(id as string),
    enabled: id !== undefined,
    retry: (failures, error) => !isNotFound(error) && failures < 2,
  });
  const missing = id !== undefined && isNotFound(query.error);
  const reportedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!missing || id === undefined || reportedFor.current === id) return;
    reportedFor.current = id;
    notify.info(t(ERRORS_KEYS.route.recordNotFound, { record: recordLabel }));
    onMissing();
  }, [missing, id, recordLabel, onMissing, t]);

  return {
    record: id === undefined ? undefined : query.data,
    isOpen: id !== undefined && !missing,
    isPending: id !== undefined && query.isPending,
    isError: id !== undefined && query.isError && !missing,
    refetch: () => void query.refetch(),
  };
}
