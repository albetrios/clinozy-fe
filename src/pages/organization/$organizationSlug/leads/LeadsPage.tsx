import { Outlet } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { useLeadsDialogRoute } from './hooks/useLeadsDialogRoute/index.ts';
import { LEADS_KEYS, LEADS_NS } from './leads.constants.ts';

/**
 * Leads room. Its dialog routes — New lead (`create/`) and the lead drawer
 * (`$leadId/`) — render nothing: this page reads the URL and opens their
 * drawers over itself. The drawers land with their own ledger rows (L-34b,
 * L-35); the route already answers a dead link with the list and "Lead not
 * found". The list itself is built in its own row (L-33b).
 */
export function LeadsPage() {
  const { t } = useTranslation(LEADS_NS);
  useLeadsDialogRoute();
  return (
    <section data-testid="leads-page" className="flex min-h-0 flex-1 flex-col">
      <h1 className="sr-only md:not-sr-only md:px-(--room-header-pad-x) md:pt-4 md:text-xl md:font-semibold">
        {t(LEADS_KEYS.manifest.title)}
      </h1>
      <Outlet />
    </section>
  );
}
