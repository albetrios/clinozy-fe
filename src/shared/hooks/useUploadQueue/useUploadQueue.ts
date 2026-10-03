import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { UPLOAD_MAX_BYTES } from '@/shared/api/uploads-api.ts';
import { formatFileSize } from '@/shared/components/UploadTray/format-file-size.ts';
import {
  UPLOAD_TRAY_KEYS,
  UPLOAD_TRAY_NS,
} from '@/shared/components/UploadTray/upload-tray.constants.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import {
  type UploadTarget,
  useUploadQueueStore,
} from '@/shared/store/useUploadQueueStore/index.ts';

/** The one size limit clinic uploads carry: clinozy-be's `organization-file` cap (KICKOFF Q-P5). */
const UPLOAD_LIMIT_BYTES = UPLOAD_MAX_BYTES['organization-file'];

/** One id, so a second oversized drop replaces the toast rather than stacking it (rule 7). */
const SKIPPED_TOAST_ID = 'upload-skipped';

/** What `enqueue` did with the files it was handed. */
interface EnqueueResult {
  /** Files queued into the tray. */
  accepted: number;
  /** Files over the limit, left out and named in a toast. */
  skipped: number;
}

/**
 * Hand files to the shared upload tray — the one way a screen uploads a clinic file.
 *
 * @remarks
 * `enqueue` drops files over 10 MB with the toast "<n> file(s) over 10 MB skipped" (a skip
 * is never silent — house rule 3), queues the rest into the active organization's storage
 * and returns at once; the tray shows progress, failures and Retry. `onUploaded` receives
 * each file's confirmed storage key — attach it to the record there. The upload survives
 * the screen that started it, so `onUploaded` must not depend on that screen staying mounted.
 *
 * @example
 * const { enqueue } = useUploadQueue();
 * enqueue(event.target.files ?? [], {
 *   onUploaded: (key) => attachPhoto({ patientId, key }),
 * });
 */
export function useUploadQueue(): {
  enqueue: (files: FileList | readonly File[], target: UploadTarget) => EnqueueResult;
} {
  const { t } = useTranslation(UPLOAD_TRAY_NS);
  const { formatNumber } = useLocaleFormat();
  const organizationId = useOrganizationStore((state) => state.organizationId);
  const add = useUploadQueueStore((state) => state.add);

  const enqueue = useCallback(
    (files: FileList | readonly File[], target: UploadTarget): EnqueueResult => {
      const all = Array.from(files);
      const fitting = all.filter((file) => file.size <= UPLOAD_LIMIT_BYTES);
      const skipped = all.length - fitting.length;
      if (skipped > 0) {
        notify.warning(
          t(UPLOAD_TRAY_KEYS.skipped, {
            count: skipped,
            limit: formatFileSize(UPLOAD_LIMIT_BYTES, { t, formatNumber }),
          }),
          { id: SKIPPED_TOAST_ID },
        );
      }
      add(fitting, target, organizationId ?? undefined);
      return { accepted: fitting.length, skipped };
    },
    [add, formatNumber, organizationId, t],
  );

  return { enqueue };
}
