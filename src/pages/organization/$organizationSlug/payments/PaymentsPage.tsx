import { useTranslation } from 'react-i18next';

import { PAYMENTS_KEYS, PAYMENTS_NS } from './payments.constants.ts';

/**
 * Payments room. The island and its route land first (L-12a) so the shell, the
 * role-home resolver and the redirects have a room to reach; the screen itself
 * is built in its own ledger row.
 */
export function PaymentsPage() {
  const { t } = useTranslation(PAYMENTS_NS);
  return (
    <section data-testid="payments-page" className="flex min-h-0 flex-1 flex-col">
      <h1 className="sr-only md:not-sr-only md:px-(--room-header-pad-x) md:pt-4 md:text-xl md:font-semibold">
        {t(PAYMENTS_KEYS.manifest.title)}
      </h1>
    </section>
  );
}
