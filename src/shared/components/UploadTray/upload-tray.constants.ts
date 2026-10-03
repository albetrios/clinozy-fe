import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** Upload tray copy lives in `common`: the tray is shell chrome, mounted once for every room. */
export const UPLOAD_TRAY_NS = I18N_NAMESPACES.common;

/** Key paths for the upload tray and its "skipped" toast (KICKOFF §3.5; `_patterns.md:248–255`). */
export const UPLOAD_TRAY_KEYS = {
  label: 'uploadTray.label',
  uploading: 'uploadTray.uploading',
  complete: 'uploadTray.complete',
  failed: 'uploadTray.failed',
  skipped: 'uploadTray.skipped',
  show: 'uploadTray.show',
  hide: 'uploadTray.hide',
  uploadFailed: 'uploadTray.uploadFailed',
  attachFailed: 'uploadTray.attachFailed',
  retry: 'uploadTray.retry',
  remove: 'uploadTray.remove',
  size: {
    kilobytes: 'uploadTray.size.kilobytes',
    megabytes: 'uploadTray.size.megabytes',
  },
} as const;
