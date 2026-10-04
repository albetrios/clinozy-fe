import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  PATIENT_PHOTOS_KEYS,
  PATIENT_PHOTOS_NS,
} from '../../../../shared/patient-photos.constants.ts';

/**
 * A photo the URL names that is gone — deleted, unknown, or in an album the
 * member can't open (the read leaves it out): "Photo not found · it may have
 * been deleted" (`S:115`), once, then `onLeave` (back to the Photos section).
 */
export function useMissingPhoto(missing: boolean, onLeave: () => void): void {
  const { t } = useTranslation([PATIENT_PHOTOS_NS, ERRORS_NS]);
  const told = useRef(false);
  useEffect(() => {
    if (!missing || told.current) return;
    told.current = true;
    notify.info(
      t(ERRORS_KEYS.route.recordNotFound, {
        ns: ERRORS_NS,
        record: t(PATIENT_PHOTOS_KEYS.viewer.notFoundRecord),
      }),
    );
    onLeave();
  }, [missing, onLeave, t]);
}
