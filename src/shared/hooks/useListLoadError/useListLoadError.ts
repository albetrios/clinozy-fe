import { useEffect, useRef } from 'react';

import i18n from '@/lib/i18n/i18n.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { notify, TOAST_DURATION_MS } from '@/shared/notify/index.ts';

/** What the toast reads of a list query. */
interface ListLoadState {
  isError: boolean;
  /** Load the list again — the toast's "Retry". */
  refetch: () => void;
}

/**
 * A room list's load failure (KICKOFF §6.0 List error): the toast "Couldn’t
 * load this list · connection dropped. Showing the last copy." with "Retry"
 * for 9,000ms, once per failure — the rows already on screen stay. Pair it
 * with the list read's `notifyOnError: false`, so the generic error toast does
 * not say it twice. `listId` keeps one toast per list, replaced, never stacked.
 */
export function useListLoadError(
  { isError, refetch }: ListLoadState,
  listId: string,
): void {
  const shown = useRef(false);

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
}
