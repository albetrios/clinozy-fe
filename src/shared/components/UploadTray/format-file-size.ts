import type { TFunction } from 'i18next';

import { UPLOAD_TRAY_KEYS } from './upload-tray.constants.ts';

const KILOBYTE = 1024;
const MEGABYTE = 1024 * 1024;

/**
 * A file size as the upload tray writes it — "1.2 MB", "84 KB" (H:6083): megabytes to one
 * decimal above 1 MB, otherwise whole kilobytes and never below 1.
 *
 * @remarks
 * The number goes through the locale formatter (Appearance number prefs apply); the unit is
 * copy, so English reads exactly as designed where `Intl` would write "kB".
 *
 * @param bytes - The size in bytes.
 * @param format - `t` from the upload tray's namespace and `useLocaleFormat().formatNumber`.
 */
export function formatFileSize(
  bytes: number,
  format: {
    t: TFunction;
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  },
): string {
  if (bytes > MEGABYTE) {
    return format.t(UPLOAD_TRAY_KEYS.size.megabytes, {
      value: format.formatNumber(bytes / MEGABYTE, { maximumFractionDigits: 1 }),
    });
  }
  return format.t(UPLOAD_TRAY_KEYS.size.kilobytes, {
    value: format.formatNumber(Math.max(1, Math.round(bytes / KILOBYTE)), {
      maximumFractionDigits: 0,
    }),
  });
}
