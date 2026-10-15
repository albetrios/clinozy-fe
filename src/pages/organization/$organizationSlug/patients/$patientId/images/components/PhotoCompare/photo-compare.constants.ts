/** The comparison's test ids. */
export const PHOTO_COMPARE_TEST_IDS = {
  root: 'patient-photo-compare',
  stage: 'patient-photo-compare-stage',
  panel: 'patient-photo-compare-panel',
  pending: 'patient-photo-compare-pending',
  since: 'patient-photo-compare-since',
  remove: 'patient-photo-compare-remove',
  layout: 'patient-photo-compare-layout',
  /** Linked ↔ Separate; each radio adds `-linked` / `-separate`. */
  zoomMode: 'patient-photo-compare-zoom-mode',
  /** Separate: every photo back to 100%. */
  resetAll: 'patient-photo-compare-reset-all',
  zoomOut: 'patient-photo-compare-zoom-out',
  zoomReset: 'patient-photo-compare-zoom-reset',
  zoomIn: 'patient-photo-compare-zoom-in',
  close: 'patient-photo-compare-close',
} as const;

/** A panel's own zoom group (Separate) — one per panel, told apart by the panel's `data-photo`. */
export const PHOTO_COMPARE_PANEL_ZOOM_TEST_IDS = {
  zoomOut: 'patient-photo-compare-panel-zoom-out',
  zoomReset: 'patient-photo-compare-panel-zoom-reset',
  zoomIn: 'patient-photo-compare-panel-zoom-in',
} as const;
