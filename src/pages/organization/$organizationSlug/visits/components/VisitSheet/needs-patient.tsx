import { useTranslation } from 'react-i18next';

import { VISIT_KEYS, VISIT_NS, VISIT_TEST_IDS } from '../../visits.constants.ts';

/**
 * A lead's visit (no patient record yet): the Rx, the session and the bill
 * are the patient's records, so the tab says what comes first — the status
 * machine's own words for a visit that can't complete without one.
 */
export function NeedsPatient() {
  const { t } = useTranslation(VISIT_NS);
  return (
    <p
      role="note"
      data-testid={VISIT_TEST_IDS.needsPatient}
      className="text-body text-muted-foreground-strong px-5.5 py-6"
    >
      {t(VISIT_KEYS.needsPatient)}
    </p>
  );
}
