import { useTranslation } from 'react-i18next';

import { PATIENTS_KEYS, PATIENTS_NS } from './patients.constants.ts';

/**
 * Patients room. The island and its route land first (L-12a) so the shell, the
 * role-home resolver and the redirects have a room to reach; the screen itself
 * is built in its own ledger row.
 */
export function PatientsPage() {
  const { t } = useTranslation(PATIENTS_NS);
  return (
    <section data-testid="patients-page" className="flex min-h-0 flex-1 flex-col">
      <h1 className="sr-only md:not-sr-only md:px-(--room-header-pad-x) md:pt-4 md:text-xl md:font-semibold">
        {t(PATIENTS_KEYS.manifest.title)}
      </h1>
    </section>
  );
}
