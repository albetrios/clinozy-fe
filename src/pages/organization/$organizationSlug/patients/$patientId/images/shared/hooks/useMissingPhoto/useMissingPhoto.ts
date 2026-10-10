import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { notifyError } from '@/shared/errors/errorHandler.ts';
import { isNotFound } from '@/shared/errors/HttpError.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  PATIENT_PHOTOS_KEYS,
  PATIENT_PHOTOS_NS,
} from '../../../../shared/patient-photos.constants.ts';

/**
 * The photo the URL names could not be read (`error`, null while it reads or once it has):
 * a 404 — deleted, unknown, or in an album the member can't open — says "Photo not found · it
 * may have been deleted" (`S:115`); any other failure its own message. Once, then `onLeave`
 * (back to the Photos section).
 */
export function useMissingPhoto(error: unknown, onLeave: () => void): void {
  const { t } = useTranslation([PATIENT_PHOTOS_NS, ERRORS_NS]);
  const told = useRef(false);
  const failed = error !== null && error !== undefined;
  useEffect(() => {
    if (!failed || told.current) return;
    told.current = true;
    if (isNotFound(error)) {
      notify.info(
        t(ERRORS_KEYS.route.recordNotFound, {
          ns: ERRORS_NS,
          record: t(PATIENT_PHOTOS_KEYS.viewer.notFoundRecord),
        }),
      );
    } else {
      notifyError(error);
    }
    onLeave();
  }, [error, failed, onLeave, t]);
}
