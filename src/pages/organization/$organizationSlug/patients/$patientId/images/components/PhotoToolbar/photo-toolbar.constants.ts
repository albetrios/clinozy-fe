/** The toolbar's test-id prefix: tabs `patient-photos-tab-<album>`, the filter, the sizes. */
export const PHOTO_TOOLBAR_TEST_IDS = {
  prefix: 'patient-photos',
  visitFilter: 'patient-photos-visit-filter',
  size: 'patient-photos-size',
  /** "Select" / "Done" — picking photos to compare. */
  select: 'patient-photos-select',
} as const;
