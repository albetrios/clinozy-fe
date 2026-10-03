import { useTranslation } from 'react-i18next';

import { MEDICAL_SALES_KEYS, MEDICAL_SALES_NS } from './sales.constants.ts';

/**
 * Medical › Sales. Scaffolded with the route plumbing (L-12a); the screen is
 * built in its own ledger row.
 */
export function SalesPage() {
  const { t } = useTranslation(MEDICAL_SALES_NS);
  return (
    <section data-testid="medical-sales-page" className="flex min-h-0 flex-1 flex-col">
      <h1 className="sr-only md:not-sr-only md:px-(--room-header-pad-x) md:pt-4 md:text-xl md:font-semibold">
        {t(MEDICAL_SALES_KEYS.manifest.title)}
      </h1>
    </section>
  );
}
