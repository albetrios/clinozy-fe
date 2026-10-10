import {
  defaultStringifySearch,
  lazyRouteComponent,
  type RouteComponent,
  useLocation,
  useParams,
  useRouter,
} from '@tanstack/react-router';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { toGateContext } from '@/core/security/gate-context.ts';
import { gatewayFromManifest } from '@/core/security/gateway.ts';
import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';
import {
  CROSS_ROOM_PARAM,
  type CrossRoomDialogLocation,
  crossRoomDialogOf,
  type CrossRoomRoute,
  withoutCrossRoomDialog,
} from '@/shared/clinic/clinic-referrer.ts';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import { SectionErrorBoundary } from '@/shared/components/WidgetErrorBoundary/index.ts';
import {
  type CrossRoomDialog,
  CrossRoomDialogContext,
} from '@/shared/hooks/useCrossRoomDialog/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { localizedRoute } from './localized-route.ts';

// Each room's drawer host — its dialog-route reader and its drawer — with the
// room's copy, loaded the first time a drawer of that room opens elsewhere.
const InvoicesHost = lazyRouteComponent(
  () => import('@/pages/organization/$organizationSlug/invoices/invoices.route.tsx'),
  'Component',
);
const PaymentsHost = lazyRouteComponent(
  localizedRoute(
    [I18N_NAMESPACES.payments],
    () =>
      import('@/pages/organization/$organizationSlug/payments/components/PaymentsDrawers/index.ts'),
  ),
  'PaymentsDialogHost',
);
const AppointmentsHost = lazyRouteComponent(
  localizedRoute(
    [I18N_NAMESPACES.appointments],
    () =>
      import('@/pages/organization/$organizationSlug/appointments/components/AppointmentDialog/index.ts'),
  ),
  'AppointmentDialog',
);
const SalesHost = lazyRouteComponent(
  localizedRoute(
    [I18N_NAMESPACES.medical],
    () =>
      import('@/pages/organization/$organizationSlug/medical/sales/components/SaleDrawers/index.ts'),
  ),
  'SaleDrawers',
);

/** The host that renders each cross-room drawer: its own room's, reading the drawer's route. */
const HOSTS: Readonly<Record<CrossRoomRoute['name'], RouteComponent>> = {
  appointmentCreate: AppointmentsHost,
  appointment: AppointmentsHost,
  paymentReceive: PaymentsHost,
  paymentEdit: PaymentsHost,
  invoiceCreate: InvoicesHost,
  invoice: InvoicesHost,
  invoiceEdit: InvoicesHost,
  saleCreate: SalesHost,
};

/**
 * One cross-room drawer over the page: its own route's gate first — the
 * gateway its manifest declares, as the drawer route runs it (KICKOFF §4) —
 * then its room's host, reading the drawer's route from the context. Refused,
 * it is the permission toast and the page alone again.
 */
function CrossRoomDialogHost({ dialog }: { dialog: CrossRoomDialogLocation }) {
  const router = useRouter();
  const { t } = useTranslation(ERRORS_NS);
  const [passed, setPassed] = useState(false);

  // Back to the page as it stands — its search and hash, the drawer's name dropped.
  const close = useCallback(() => {
    const { pathname, search, hash } = router.state.location;
    const page = defaultStringifySearch(withoutCrossRoomDialog(search));
    const fragment = hash ? `#${hash}` : '';
    void router.navigate({
      href: `${pathname}${page}${fragment}`,
      replace: true,
      resetScroll: false,
    });
  }, [router]);

  useEffect(() => {
    let live = true;
    const gate = async () => {
      const { DIALOG_ROUTES } = await import('./dialog-routes.ts');
      const { manifest } = DIALOG_ROUTES[dialog.route.name];
      await gatewayFromManifest(manifest)(
        toGateContext(
          { pathname: dialog.pathname, search: '', hash: '', href: dialog.href },
          dialog.params,
        ),
      );
    };
    gate().then(
      () => {
        if (live) setPassed(true);
      },
      () => {
        if (!live) return;
        notify.info(t(ERRORS_KEYS.api.http403));
        close();
      },
    );
    return () => {
      live = false;
    };
  }, [dialog, close, t]);

  const value = useMemo<CrossRoomDialog>(
    () => ({
      pathname: dialog.pathname,
      search: dialog.search,
      params: dialog.params,
      close,
    }),
    [dialog, close],
  );

  if (!passed) return null;
  const Host = HOSTS[dialog.route.name];
  return (
    <CrossRoomDialogContext.Provider value={value}>
      <SectionErrorBoundary title={t(ERRORS_KEYS.widget.pageContent)} variant="silent">
        <TooltipProvider>
          <Suspense fallback={null}>
            <Host />
          </Suspense>
        </TooltipProvider>
      </SectionErrorBoundary>
    </CrossRoomDialogContext.Provider>
  );
}

/**
 * The drawer another room owns, over the room it was opened from (KICKOFF §4,
 * A-P1): the Invoice drawer, Receive payment, a ledger entry's drawer, the
 * appointment drawers or New sale named in the page's search (`useClinicNavigate`, or the drawer route's
 * hand-over), while the URL bar shows the drawer's own route. The page stays
 * the router's route, mounted behind it, its own guards run; the drawer's
 * route gates it here and its room's host opens it. Mounted once with the org
 * shell; nothing renders while no drawer is named.
 */
export function CrossRoomDialogs() {
  const { organizationSlug = '' } = useParams({ strict: false });
  const named = useLocation({
    select: (location) => (location.search as Record<string, unknown>)[CROSS_ROOM_PARAM],
  });
  const dialog = useMemo(
    () => crossRoomDialogOf({ [CROSS_ROOM_PARAM]: named }, organizationSlug),
    [named, organizationSlug],
  );
  // One host per drawer route: a change of its search alone keeps the drawer.
  return dialog ? <CrossRoomDialogHost key={dialog.pathname} dialog={dialog} /> : null;
}
