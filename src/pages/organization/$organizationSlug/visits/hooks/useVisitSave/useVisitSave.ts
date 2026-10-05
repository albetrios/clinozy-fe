import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import { mapApiError } from '@/shared/errors/errorHandler.ts';
import { isHttpError } from '@/shared/errors/HttpError.ts';
import { notify } from '@/shared/notify/index.ts';

/** Where the sheet's last write stands — the tab row's label. */
export type VisitSaveState = 'idle' | 'saving' | 'failed';

/** One toast for the sheet's failed saves, so a second failure replaces the first. */
const FAILED_TOAST_ID = 'visit-save-failed';

/** The sheet's write runner and its state. */
export interface VisitSave {
  state: VisitSaveState;
  /**
   * Run a tab's write: "Saving…" until it lands, then `onDone`. A refusal
   * (4xx) toasts the server's words and changes nothing else; a dropped
   * connection or a server failure leaves "Not saved · your changes are kept"
   * and the 9s "Couldn't save" toast whose Retry runs it again.
   */
  run: <T>(write: () => Promise<T>, onDone: (result: T) => void) => Promise<void>;
}

/**
 * The Visit sheet's saves (KICKOFF §6.13 States; §6.0; `fe-http-forms-errors`)
 * — the record drawer's outcomes (`useDrawerSave`) for a sheet that has no
 * form: one state for every tab, since the tab row shows it, and the drafts
 * stay in the sheet's store whatever happens.
 */
export function useVisitSave(): VisitSave {
  const { t } = useTranslation([RECORD_DRAWER_NS, ERRORS_NS]);
  const [state, setState] = useState<VisitSaveState>('idle');
  const running = useRef(0);

  const run = useCallback(
    async function run<T>(
      write: () => Promise<T>,
      onDone: (result: T) => void,
    ): Promise<void> {
      running.current += 1;
      setState('saving');
      try {
        const result = await write();
        running.current -= 1;
        if (running.current === 0) setState('idle');
        onDone(result);
      } catch (error) {
        running.current -= 1;
        if (isHttpError(error) && error.status < 500) {
          if (running.current === 0) setState('idle');
          notify.error(mapApiError(error));
          return;
        }
        setState('failed');
        notify.error(t(RECORD_DRAWER_KEYS.saveFailed, { ns: RECORD_DRAWER_NS }), {
          id: FAILED_TOAST_ID,
          action: {
            label: t(ERRORS_KEYS.widget.retry, { ns: ERRORS_NS }),
            onClick: () => void run(write, onDone),
          },
        });
      }
    },
    [t],
  );

  return { state, run };
}
