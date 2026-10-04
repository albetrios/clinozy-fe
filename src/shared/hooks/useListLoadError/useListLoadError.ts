import { useEffect, useRef, useState } from 'react';

import i18n from '@/lib/i18n/i18n.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { notify, TOAST_DURATION_MS } from '@/shared/notify/index.ts';

/** What the toast reads of a list query — and, to keep the last copy, its rows. */
interface ListLoadState<T> {
  isError: boolean;
  /** Load the list again — the toast's "Retry". */
  refetch: () => void;
  /** The rows the read answers now (a `useCursorList` result's). */
  rows?: readonly T[];
  /** The first load is still in flight. */
  isPending?: boolean;
}

const NO_ROWS: readonly never[] = [];

/**
 * A room list's load failure (KICKOFF §6.0 List error): the toast "Couldn’t
 * load this list · connection dropped. Showing the last copy." with "Retry"
 * for 9,000ms, once per failure. Pair it with the list read's
 * `notifyOnError: false`, so the generic error toast does not say it twice.
 * `listId` keeps one toast per list, replaced, never stacked.
 *
 * It answers the rows to show: the read's, or — when a read fails with nothing
 * to show (a new view whose first page never came) — the last rows a read
 * answered, so the list keeps "the last copy" the toast promises.
 */
export function useListLoadError<T>(
  { isError, refetch, rows, isPending = false }: ListLoadState<T>,
  listId: string,
): readonly T[] {
  const shown = useRef(false);
  const current = rows ?? NO_ROWS;
  const [lastCopy, setLastCopy] = useState<readonly T[]>(current);
  if (!(isError || isPending) && current !== lastCopy) setLastCopy(current);

  useEffect(() => {
    if (!isError) {
      shown.current = false;
      return;
    }
    if (shown.current) return;
    shown.current = true;
    notify.error(i18n.t(CLINIC_KEYS.lists.loadError, { ns: CLINIC_NS }), {
      id: `list-error:${listId}`,
      duration: TOAST_DURATION_MS.error,
      action: {
        label: i18n.t(CLINIC_KEYS.lists.retry, { ns: CLINIC_NS }),
        onClick: refetch,
      },
    });
  }, [isError, refetch, listId]);

  return isError && current.length === 0 ? lastCopy : current;
}
