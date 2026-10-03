import { useTranslation } from 'react-i18next';

import { STOCK_ITEMS_KEYS, STOCK_ITEMS_NS } from './items.constants.ts';

/**
 * Clinic stock › Items. Scaffolded with the route plumbing (L-12a); the screen is
 * built in its own ledger row.
 */
export function ItemsPage() {
  const { t } = useTranslation(STOCK_ITEMS_NS);
  return (
    <section data-testid="stock-items-page" className="flex min-h-0 flex-1 flex-col">
      <h1 className="sr-only md:not-sr-only md:px-(--room-header-pad-x) md:pt-4 md:text-xl md:font-semibold">
        {t(STOCK_ITEMS_KEYS.manifest.title)}
      </h1>
    </section>
  );
}
