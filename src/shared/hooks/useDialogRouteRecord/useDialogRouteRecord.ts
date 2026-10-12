import type { QueryKey } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { isNotFound } from '@/shared/errors/HttpError.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
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

/** Every id may name a record — the default for a room still on fixtures (uuid ids). */
const ANY_ID = () => true;

/**
 * The dialog-route deep-link pattern (KICKOFF §4, `S:115`). A URL-driven drawer
 * route renders nothing; its parent page passes the route's id here and opens
 * the drawer from the result. An id that matches no record — a stale link, a
 * deleted record, or one `isWellFormed` turns away unread — leaves the parent
 * page behind with no drawer: one toast, "<Record> not found · it may have been
 * deleted", and `onMissing` (navigate back to the parent, replacing the dead URL).
 */
export function useDialogRouteRecord<T>({
  id,
  queryKey,
  fetchRecord,
  recordLabel,
  onMissing,
  isWellFormed = ANY_ID,
}: {
  /** The dialog route's id param; undefined while the route is not matched. */
  id: string | undefined;
  queryKey: (id: string) => QueryKey;
  fetchRecord: (id: string) => Promise<T>;
  /** The record's name in the toast ("Lead", "Appointment"). */
  recordLabel: string;
  onMissing: () => void;
  /**
   * Whether the id can name a record at all. A room on clinozy-be passes its public-id shape
   * (`PUBLIC_ID`): a link from the fixture days or a mistyped one is then "not found" at once
   * and never sent — the API would refuse it with a 400, not a 404. Every id by default.
   */
  isWellFormed?: (id: string) => boolean;
}): DialogRouteRecord<T> {
  const { t } = useTranslation(ERRORS_NS);
  const malformed = id !== undefined && !isWellFormed(id);
  const readId = malformed ? undefined : id;
  const query = useAppQuery({
    queryKey: readId === undefined ? ['dialog-route', 'none'] : queryKey(readId),
    queryFn: () => fetchRecord(readId as string),
    enabled: readId !== undefined,
    retry: (failures, error) => !isNotFound(error) && failures < 2,
    // The drawer says it in place: a missing record closes with its own notice, another failure
    // is the hook's `isError`.
    notifyOnError: false,
  });
  const missing = malformed || (id !== undefined && isNotFound(query.error));
  const reportedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!missing || id === undefined || reportedFor.current === id) return;
    reportedFor.current = id;
    notify.info(t(ERRORS_KEYS.route.recordNotFound, { record: recordLabel }));
    onMissing();
  }, [missing, id, recordLabel, onMissing, t]);

  return {
    record: readId === undefined ? undefined : query.data,
    isOpen: id !== undefined && !missing,
    isPending: readId !== undefined && query.isPending,
    isError: readId !== undefined && query.isError && !missing,
    refetch: () => void query.refetch(),
  };
}
