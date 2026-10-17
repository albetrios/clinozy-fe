import {
  createRootRoute,
  createRoute,
  createRouter,
  HeadContent,
  lazyRouteComponent,
  notFound,
  Outlet,
  type ParsedLocation,
  redirect,
  type StaticDataRouteOption,
} from '@tanstack/react-router';
import { Suspense } from 'react';

import {
  requireOrgStatus,
  requireProvisionedWorkspace,
  requireSuspendedOrgStatus,
  requireTeamDeployment,
  resolveActiveOrg,
} from '@/app/guards/org-gates.ts';
import { requireOnboardingWorkspace } from '@/app/guards/route-guards.ts';
import { CriticalUpdateNoticeLazy } from '@/app/version/CriticalUpdateNoticeLazy.tsx';
import { redirectIfAuthenticated, requireAuth } from '@/core/rbac/guards.ts';
import { toGateContext } from '@/core/security/gate-context.ts';
import { gatewayFromManifest } from '@/core/security/gateway.ts';
import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import i18n from '@/lib/i18n/i18n.ts';
import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';
import { organizationHome } from '@/lib/routes/builders.ts';
import {
  APP_DESCRIPTION,
  APP_TITLE,
  composePageTitle,
  manifestHead,
} from '@/lib/routes/page-head.ts';
import type { PageManifest } from '@/lib/routes/page-manifest.ts';
import { parseInvitationIdParam, parseOAuthProviderParam } from '@/lib/routes/params.ts';
import { manifest as acceptInviteManifest } from '@/pages/accept-invite/accept-invite.manifest.ts';
import { manifest as callbackManifest } from '@/pages/callback/callback.manifest.ts';
import { validateCallbackSearch } from '@/pages/callback/callback.search.ts';
import { manifest as loginManifest } from '@/pages/login/login.manifest.ts';
import { validateLoginSearch } from '@/pages/login/login.search.ts';
import { manifest as mfaManifest } from '@/pages/mfa/mfa.manifest.ts';
import { manifest as onboardingManifest } from '@/pages/onboarding/onboarding.manifest.ts';
import { validateOnboardingSearch } from '@/pages/onboarding/onboarding.search.ts';
import type {
  AppointmentCreateSearch,
  AppointmentSearch,
} from '@/pages/organization/$organizationSlug/appointments/appointments.dialog-search.ts';
import { manifest as appointmentsManifest } from '@/pages/organization/$organizationSlug/appointments/appointments.manifest.ts';
import { validateAppointmentsSearch } from '@/pages/organization/$organizationSlug/appointments/appointments.search.ts';
import { manifest as branchesManifest } from '@/pages/organization/$organizationSlug/branches/branches.manifest.ts';
import { validateBranchesSearch } from '@/pages/organization/$organizationSlug/branches/branches.search.ts';
import type { InvoiceCreateSearch } from '@/pages/organization/$organizationSlug/invoices/invoices.dialog-search.ts';
import { manifest as invoicesManifest } from '@/pages/organization/$organizationSlug/invoices/invoices.manifest.ts';
import { validateInvoiceSearch } from '@/pages/organization/$organizationSlug/invoices/invoices.search.ts';
import type { LeadCreateSearch } from '@/pages/organization/$organizationSlug/leads/leads.dialog-search.ts';
import { manifest as leadsManifest } from '@/pages/organization/$organizationSlug/leads/leads.manifest.ts';
import { validateLeadsSearch } from '@/pages/organization/$organizationSlug/leads/leads.search.ts';
import { manifest as medicalCreditsManifest } from '@/pages/organization/$organizationSlug/medical/credits/credits.manifest.ts';
import { manifest as medicalManufacturersManifest } from '@/pages/organization/$organizationSlug/medical/manufacturers/manufacturers.manifest.ts';
import type { MedicalCreateSearch } from '@/pages/organization/$organizationSlug/medical/medical.dialog-search.ts';
import { manifest as medicalManifest } from '@/pages/organization/$organizationSlug/medical/medical.manifest.ts';
import {
  validateMedicalCreditsSearch,
  validateMedicalPaymentsSearch,
  validateMedicalSearch,
} from '@/pages/organization/$organizationSlug/medical/medical.search.ts';
import { manifest as medicalMedicinesManifest } from '@/pages/organization/$organizationSlug/medical/medicines/medicines.manifest.ts';
import { manifest as medicalMrsManifest } from '@/pages/organization/$organizationSlug/medical/mrs/mrs.manifest.ts';
import { manifest as medicalPaymentsManifest } from '@/pages/organization/$organizationSlug/medical/payments/payments.manifest.ts';
import { manifest as medicalPurchasesManifest } from '@/pages/organization/$organizationSlug/medical/purchases/purchases.manifest.ts';
import { manifest as medicalSalesManifest } from '@/pages/organization/$organizationSlug/medical/sales/sales.manifest.ts';
import { manifest as medicalSuppliersManifest } from '@/pages/organization/$organizationSlug/medical/suppliers/suppliers.manifest.ts';
import type { OfferingCreateSearch } from '@/pages/organization/$organizationSlug/offerings/offerings.dialog-search.ts';
import { manifest as offeringsManifest } from '@/pages/organization/$organizationSlug/offerings/offerings.manifest.ts';
import { validateOfferingsSearch } from '@/pages/organization/$organizationSlug/offerings/offerings.search.ts';
import { manifest as offersManifest } from '@/pages/organization/$organizationSlug/offerings/offers/offers.manifest.ts';
import { validateOffersSearch } from '@/pages/organization/$organizationSlug/offerings/offers/offers.search.ts';
import { manifest as organizationShellManifest } from '@/pages/organization/$organizationSlug/organization-slug.manifest.ts';
import { validatePatientImagesSearch } from '@/pages/organization/$organizationSlug/patients/$patientId/images/images.search.ts';
import type {
  PatientFeedbackDialogSearch,
  PatientFileDialogSearch,
  PatientRxCreateSearch,
} from '@/pages/organization/$organizationSlug/patients/$patientId/patient-id.dialog-search.ts';
import { manifest as patientFileManifest } from '@/pages/organization/$organizationSlug/patients/$patientId/patient-id.manifest.ts';
import {
  type PatientFileSearch,
  validatePatientFileSearch,
} from '@/pages/organization/$organizationSlug/patients/$patientId/patient-id.search.ts';
import type { PatientCreateSearch } from '@/pages/organization/$organizationSlug/patients/patients.dialog-search.ts';
import { manifest as patientsManifest } from '@/pages/organization/$organizationSlug/patients/patients.manifest.ts';
import { validatePatientsSearch } from '@/pages/organization/$organizationSlug/patients/patients.search.ts';
import type {
  DayCloseSearch,
  PaymentPaySearch,
  PaymentReceiveSearch,
} from '@/pages/organization/$organizationSlug/payments/payments.dialog-search.ts';
import { manifest as paymentsManifest } from '@/pages/organization/$organizationSlug/payments/payments.manifest.ts';
import { validatePaymentsSearch } from '@/pages/organization/$organizationSlug/payments/payments.search.ts';
import { manifest as pendingManifest } from '@/pages/organization/$organizationSlug/payments/pending/pending.manifest.ts';
import { validatePendingSearch } from '@/pages/organization/$organizationSlug/payments/pending/pending.search.ts';
import { manifest as stockItemsManifest } from '@/pages/organization/$organizationSlug/stock/items/items.manifest.ts';
import { manifest as stockMovementsManifest } from '@/pages/organization/$organizationSlug/stock/movements/movements.manifest.ts';
import { manifest as stockPurchasesManifest } from '@/pages/organization/$organizationSlug/stock/purchases/purchases.manifest.ts';
import type { StockCreateSearch } from '@/pages/organization/$organizationSlug/stock/stock.dialog-search.ts';
import { manifest as stockManifest } from '@/pages/organization/$organizationSlug/stock/stock.manifest.ts';
import { validateStockSearch } from '@/pages/organization/$organizationSlug/stock/stock.search.ts';
import { manifest as stockVendorsManifest } from '@/pages/organization/$organizationSlug/stock/vendors/vendors.manifest.ts';
import { manifest as suspendedManifest } from '@/pages/organization/$organizationSlug/suspended/suspended.manifest.ts';
import type { TaskCreateSearch } from '@/pages/organization/$organizationSlug/tasks/tasks.dialog-search.ts';
import { manifest as tasksManifest } from '@/pages/organization/$organizationSlug/tasks/tasks.manifest.ts';
import { validateTasksSearch } from '@/pages/organization/$organizationSlug/tasks/tasks.search.ts';
import { manifest as todayManifest } from '@/pages/organization/$organizationSlug/today/today.manifest.ts';
import { validateTodaySearch } from '@/pages/organization/$organizationSlug/today/today.search.ts';
import { manifest as usersRolesManifest } from '@/pages/organization/$organizationSlug/users/roles/roles.manifest.ts';
import type { UserEditSearch } from '@/pages/organization/$organizationSlug/users/users.dialog-search.ts';
import { manifest as usersManifest } from '@/pages/organization/$organizationSlug/users/users.manifest.ts';
import {
  validateRolesSearch,
  validateUsersSearch,
} from '@/pages/organization/$organizationSlug/users/users.search.ts';
import { manifest as organizationPickerManifest } from '@/pages/organization/organization.manifest.ts';
import type { PatientFileSectionSlug } from '@/shared/app/patient-file-sections.ts';
import { AppearanceDialogLazy } from '@/shared/components/AppearanceDialog/index.ts';
import { AppSplashSlotLazy } from '@/shared/components/AppSplashSlot/index.ts';
import { ConsentBannerLazy } from '@/shared/components/ConsentBanner/index.ts';
import { FullPageSpinner } from '@/shared/components/FullPageSpinner/index.ts';
import { OfflineIndicator } from '@/shared/components/OfflineIndicator/index.ts';
import { RouteAnnouncer } from '@/shared/components/RouteAnnouncer/index.ts';
import { RouteErrorBoundary } from '@/shared/components/RouteErrorBoundary/index.ts';
import { RouteProgressBar } from '@/shared/components/RouteProgressBar/index.ts';
import { SettingsModalLazy } from '@/shared/components/SettingsModal/index.ts';
import { SectionErrorBoundary } from '@/shared/components/WidgetErrorBoundary/index.ts';
import { AppToaster } from '@/shared/notify/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { resolveRootRedirect } from '@/shared/tenancy/organization-resolver.ts';

import type { DialogRoute } from './dialog-routes.ts';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import { localizedRoute } from './localized-route.ts';

/**
 * A URL-driven dialog route's static data (D24): the route renders nothing of
 * its own, so opening it over its page is no page change (`staticData.dialog`,
 * read by `PageTransition`).
 */
const DIALOG_STATIC_DATA: StaticDataRouteOption = { dialog: true };

/**
 * A dialog route's `validateSearch`: the route keeps the URL's values as they
 * come and only types them for the links that open it. What reads them parses
 * them — a page's `use<Room>DialogRoute` — with the validator
 * that loads with it (`<room>.dialog-search.ts`), so no dialog's schema rides
 * the entry chunk.
 */
function dialogSearch<TSearch>(): (search: Record<string, unknown>) => TSearch {
  return keepSearch as (search: Record<string, unknown>) => TSearch;
}

/** The one pass-through every dialog route's search shares. */
function keepSearch(search: Record<string, unknown>): Record<string, unknown> {
  return search;
}

// The dialog routes' manifests and components (`dialog-routes.ts`), behind ONE
// dynamic import: this file is the entry chunk, and a dialog route opens a
// drawer most loads never see.
const loadDialogRoutes = () => import('./dialog-routes.ts');

/** A dialog route's name in the `dialog-routes.ts` registry. */
type DialogRouteName = keyof Awaited<
  ReturnType<typeof loadDialogRoutes>
>['DIALOG_ROUTES'];

/**
 * A URL-driven dialog route over its page (D24) — every option but its path
 * and search. It renders nothing of its own (the page reads the URL and opens
 * the drawer), and its manifest and component load with the dialog-route
 * registry, not the entry chunk: `beforeLoad` awaits the manifest, then runs
 * the room's gate on it (gateway, then the org status guard — `roomLeafGate`),
 * so a cold load and a navigation are refused exactly as a page's are; the
 * `loader` hands the manifest to `head` for the document title. A component
 * that is lazy itself is preloaded with the registry, so it never suspends on
 * its first render. Past the gate, a drawer another room opened hands over to
 * that room (`handOverToReferrer`, A-P1).
 */
function dialogRoute(name: DialogRouteName) {
  const load = async (): Promise<DialogRoute> =>
    (await loadDialogRoutes()).DIALOG_ROUTES[name];
  const manifest = async (): Promise<PageManifest> => (await load()).manifest;
  const gate = roomLeafGate(manifest);
  return {
    staticData: DIALOG_STATIC_DATA,
    beforeLoad: async (
      context: Parameters<typeof gate>[0] & { location: ParsedLocation },
    ) => {
      await gate(context);
      if (!context.preload)
        (await loadDialogRoutes()).handOverToReferrer(context.location);
    },
    loader: manifest,
    head: ({ loaderData }: { loaderData?: PageManifest }) =>
      loaderData ? manifestHead(loaderData)() : {},
    component: lazyRouteComponent(async () => {
      const route = await load();
      await route.Component.preload?.();
      return route;
    }, 'Component'),
    errorComponent: RouteErrorBoundary,
  };
}

// ── Lazy components ──
// lazyRouteComponent (not React.lazy): the router can call `.preload()` on
// these, which is what makes `defaultPreload: 'intent'` actually fetch the
// island's chunk on hover/touch. Suspension is handled by the router's
// defaultPendingComponent. `localizedRoute` loads an island's copy with it.

const AuthLayout = lazyRouteComponent(
  localizedRoute(
    [I18N_NAMESPACES.auth],
    () => import('@/shared/layouts/AuthLayout/index.ts'),
  ),
  'AuthLayout',
);
const LoginPage = lazyRouteComponent(
  localizedRoute([I18N_NAMESPACES.auth], () => import('@/pages/login/login.route.tsx')),
  'Component',
);
const MfaPage = lazyRouteComponent(
  localizedRoute([I18N_NAMESPACES.auth], () => import('@/pages/mfa/mfa.route.tsx')),
  'Component',
);
const CallbackPage = lazyRouteComponent(
  localizedRoute(
    [I18N_NAMESPACES.auth],
    () => import('@/pages/callback/callback.route.tsx'),
  ),
  'Component',
);
const OnboardingPage = lazyRouteComponent(
  localizedRoute(
    [I18N_NAMESPACES.onboarding, I18N_NAMESPACES.auth, I18N_NAMESPACES.settings],
    () => import('@/pages/onboarding/onboarding.route.tsx'),
  ),
  'Component',
);
const AcceptInvitePage = lazyRouteComponent(
  localizedRoute(
    [I18N_NAMESPACES.auth],
    () => import('@/pages/accept-invite/accept-invite.route.tsx'),
  ),
  'Component',
);
const UnauthorizedPage = lazyRouteComponent(
  () => import('@/app/routes/UnauthorizedPage.tsx'),
  'Component',
);
const OrganizationPickerPage = lazyRouteComponent(
  localizedRoute(
    [I18N_NAMESPACES.auth],
    () => import('@/pages/organization/organization.route.tsx'),
  ),
  'Component',
);
// The org shell's nav, View-as pill and ⌘K name the clinic sections, so the
// `app` vocabulary loads with the shell rather than with each room. Its
// module adds, over any room, the drawer another room opened (A-P1).
const OrganizationShell = lazyRouteComponent(
  localizedRoute([I18N_NAMESPACES.app], () => import('./OrganizationShell.tsx')),
  'Component',
);
const SuspendedPage = lazyRouteComponent(
  () => import('@/pages/organization/$organizationSlug/suspended/suspended.route.tsx'),
  'Component',
);
// The clinic rooms' pages and tabs (`room-routes.ts`), behind ONE dynamic
// import: one per room here would put each room's preload list — every chunk
// it shares, by name — on the entry chunk. A room's own chunk is preloaded
// right after the module, so a navigation never suspends on the second hop,
// and the org shell's loader fetches the module before any room needs it.
const loadRoomRoutes = () => import('./room-routes.ts');

/** A room's name in the `room-routes.ts` module. */
type RoomRouteName = keyof Awaited<ReturnType<typeof loadRoomRoutes>>['ROOM_ROUTES'];

/** A clinic room's page or tab component, loaded through the room-route module. */
function roomRoute(name: RoomRouteName) {
  return lazyRouteComponent(async () => {
    const { ROOM_ROUTES } = await loadRoomRoutes();
    await ROOM_ROUTES[name].preload?.();
    return ROOM_ROUTES;
  }, name);
}

/**
 * Fetch the room-route module ahead of any room — speculation, so a failure
 * is swallowed: the room's own load requests it again, with its error boundary.
 */
function warmRoomRoutes(): void {
  loadRoomRoutes().catch(() => undefined);
}

// The org home's state when no clinic room is open to the member, in a room's place.
const AppHomeEmpty = roomRoute('AppHomeEmpty');
const TodayPage = roomRoute('TodayPage');
const LeadsPage = roomRoute('LeadsPage');
const AppointmentsPage = roomRoute('AppointmentsPage');
const PatientsPage = roomRoute('PatientsPage');
// The patient file (KICKOFF §6.6, L-42): its layout and every section and
// dialog route come through ONE lazy module, so this entry chunk carries one
// import for all of them. Each route's own chunk is preloaded right after the
// module, so a navigation never suspends on the second hop.
const loadPatientFile = localizedRoute(
  [I18N_NAMESPACES.patientFile],
  () =>
    import('@/pages/organization/$organizationSlug/patients/$patientId/patient-id.sections.ts'),
);
type PatientFileModule = Awaited<ReturnType<typeof loadPatientFile>>;
type PatientFileRoutes = Omit<
  PatientFileModule,
  'PATIENT_FILE_SECTION_PAGES' | 'PATIENT_FILE_DIALOG_PAGES'
>;
const patientFileComponent = (name: keyof PatientFileRoutes) =>
  lazyRouteComponent(async () => {
    const module = await loadPatientFile();
    await module[name].preload?.();
    return module;
  }, name);
// A section's page, from the same module (its own chunk preloaded the same way).
const patientFileSection = (section: PatientFileSectionSlug) =>
  lazyRouteComponent(async () => {
    const page = (await loadPatientFile()).PATIENT_FILE_SECTION_PAGES[section];
    await page.preload?.();
    return { Component: page };
  }, 'Component');
// A section's URL-driven dialog (S:35–43): it renders nothing — the section opens it.
const patientFileDialog = (
  dialog: keyof PatientFileModule['PATIENT_FILE_DIALOG_PAGES'],
) =>
  lazyRouteComponent(
    async () => ({
      Component: (await loadPatientFile()).PATIENT_FILE_DIALOG_PAGES[dialog],
    }),
    'Component',
  );
const PaymentsPage = roomRoute('PaymentsPage');
const PaymentsPendingPage = roomRoute('PaymentsPendingPage');
const TasksPage = roomRoute('TasksPage');
const OfferingsPage = roomRoute('OfferingsPage');
const OffersPage = roomRoute('OffersPage');
const UsersPage = roomRoute('UsersPage');
const UsersRolesPage = roomRoute('UsersRolesPage');
const BranchesPage = roomRoute('BranchesPage');
const MedicalLayout = roomRoute('MedicalLayout');
const MedicalSalesPage = roomRoute('MedicalSalesPage');
const MedicalMedicinesPage = roomRoute('MedicalMedicinesPage');
const MedicalPurchasesPage = roomRoute('MedicalPurchasesPage');
const MedicalSuppliersPage = roomRoute('MedicalSuppliersPage');
const MedicalManufacturersPage = roomRoute('MedicalManufacturersPage');
const MedicalMrsPage = roomRoute('MedicalMrsPage');
const MedicalPaymentsPage = roomRoute('MedicalPaymentsPage');
const MedicalCreditsPage = roomRoute('MedicalCreditsPage');
const StockLayout = roomRoute('StockLayout');
const StockItemsPage = roomRoute('StockItemsPage');
const StockPurchasesPage = roomRoute('StockPurchasesPage');
const StockMovementsPage = roomRoute('StockMovementsPage');
const StockVendorsPage = roomRoute('StockVendorsPage');
const NotFoundPage = lazyRouteComponent(
  () => import('@/app/routes/NotFoundPage.tsx'),
  'Component',
);
const PublicLayout = lazyRouteComponent(
  () => import('@/shared/layouts/PublicLayout/index.ts'),
  'PublicLayout',
);

/** The auth layout's chunk — the sign-in screen's frame. */
function preloadAuthShell(): Promise<unknown> {
  return Promise.resolve(AuthLayout.preload?.());
}

/**
 * A signed-in shell's own island. The shell route renders its island inside a
 * component of its own (the spinner while the session loads), which the
 * router's chunk preloader never sees: unwarmed, the lazy island suspended
 * through `use()` on its first render and React warned on every cold entry
 * into a clinic that it "did not call use() when it finished" — and the
 * spinner flashed once more. The island carries the app shell itself.
 */
function preloadAppShell(island: {
  preload?: () => Promise<void> | undefined;
}): Promise<unknown> {
  return Promise.resolve(island.preload?.());
}

/**
 * Warm the chunks a cold load is about to need, WHILE the auth bootstrap is in
 * flight — called once from `main.tsx`.
 *
 * Every entry route awaits `/auth/refresh` in `beforeLoad` before the router
 * loads a single component, so the destination's chunks were requested only
 * after the network had answered: guard, THEN chunks. None of that depends on
 * the answer. `likelySignedIn` is a hint,
 * not a decision — it only picks which side to warm first, and being wrong costs
 * a few idle kilobytes; the guards still decide where the user actually lands.
 *
 * Failures are swallowed on purpose: this is speculation. The router loads the
 * same chunks again through the normal path, where a failure has an error
 * boundary and a Retry (`onceAsync` and the route loaders do not cache a
 * rejection).
 */
export function preloadBootRoutes(hint: { likelySignedIn: boolean }): void {
  const warm = hint.likelySignedIn
    ? [preloadSignedInShell()]
    : [preloadAuthShell(), LoginPage.preload?.()];
  Promise.all(warm).catch(() => undefined);
}

/**
 * Warm the chunks a successful sign-in lands on.
 *
 * @remarks
 * - **Why:** {@link preloadBootRoutes} runs once, at boot, and a first-time
 *   visitor has no session hint — so it warms the PUBLIC side and the signed-in
 *   shell is not fetched until after the post-login navigation has already
 *   happened — on the far side of the login exchange, with the user already
 *   committed and watching a transition.
 * - **When:** the moment the visitor submits an email — a declaration of intent
 *   to sign in. They then spend seconds finding a six-digit code in their inbox,
 *   which is otherwise dead air on a warm connection.
 * - **Being wrong is cheap:** a visitor who abandons the form has spent idle
 *   bandwidth on chunks the guards would never have shown them, exactly as the
 *   boot-time hint already risks. Failures are swallowed for the same reason —
 *   this is speculation, and the router re-requests through the normal path
 *   where an error boundary and a Retry exist.
 */
export async function preloadSignedInShell(): Promise<void> {
  /*
   * Onboarding first, then the clinic.
   *
   * A FIRST sign-in — the case this warm-up exists for, since a returning user
   * already had the shells warmed at boot — lands on onboarding, not in a
   * clinic. It is also the smallest of the three. Starting all three at once
   * lets the much heavier org shell and its rooms compete with it for the same
   * connections, so the one chunk most likely to be needed can arrive last.
   *
   * `allSettled`, not `all`: one destination failing to warm says nothing about
   * the others, and there is no failure worth catching — the router re-requests
   * every chunk through the normal path, where an error boundary and a Retry
   * exist. It also means this never rejects, so callers need no catch.
   */
  await Promise.allSettled([OnboardingPage.preload?.()]);
  await Promise.allSettled([OrganizationShell.preload?.(), loadRoomRoutes()]);
}

// ── Root ──
const rootRoute = createRootRoute({
  head: () => ({
    meta: [{ title: APP_TITLE }, { name: 'description', content: APP_DESCRIPTION }],
  }),
  component: () => (
    <>
      <HeadContent />
      {/* Top progress bar for in-app navigations (e.g. org switch) — feedback
          without blanking the page to a full-screen spinner. */}
      <RouteProgressBar />
      <div className="bg-background text-foreground min-h-screen">
        {/* Settings is ready alongside every authenticated app outlet. */}
        <SettingsModalLazy />
      </div>
      {/* The Appearance drawer — opened via useUIStore from the Account menu's
          "Appearance & language" row. Mounted at the ROOT: without its own
          boundary a throw in here reached the global fallback and replaced the
          entire app. Silent, because an overlay has nowhere in the layout to put
          an error card — the drawer just is not there, and the throw is reported. */}
      <SectionErrorBoundary
        title={i18n.t(ERRORS_KEYS.widget.appearance, { ns: ERRORS_NS })}
        variant="silent"
      >
        <AppearanceDialogLazy />
      </SectionErrorBoundary>
      {/* Dedicated Language & region dialog — mirrors Appearance, opened via useUIStore. */}
      <OfflineIndicator />
      {/* "Update required" — a critical update counting down (core/version/check.ts).
          At the root so the sign-in screens get it too. Lazy: almost no load shows it. */}
      <CriticalUpdateNoticeLazy />
      {/* aria-live announcer: reads the new document.title on navigation. */}
      <RouteAnnouncer />
      {/* Cookie-consent gate for analytics (PostHog). Lazy: only an undecided
          visitor ever needs the card, so it stays out of the entry chunk. */}
      <ConsentBannerLazy />
      <AppToaster />
      {/* The boot splash's React slot (KICKOFF §6.1): the greeting block and the
          offline hold, rendered into the HTML #app-splash. Lazy — gone with it. */}
      <AppSplashSlotLazy />
    </>
  ),
  // The lazy page itself, never wrapped in an arrow: the router warms a notFoundComponent's
  // chunk through its `preload` before a notFound() renders it. Wrapped, a guard's notFound()
  // (an unknown or inaccessible clinic slug) rendered it cold, suspending through `use()`.
  notFoundComponent: NotFoundPage,
  errorComponent: ({ error }) => <ErrorBoundary error={error} />,
});

// ── Auth shell ──
// Pathless layout route (`id`, not `path`): mounts the AuthLayout (the launch's
// sign-in canvas) once over every auth page; the pages keep their top-level URLs
// (/login, …).
// AuthLayout is rendered inside a custom component (it wraps Outlet), so it
// keeps a local Suspense boundary — the router only manages route components.
const authShellRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'auth-shell',
  // Guest-only gateway (FE-18): a signed-in user never sees any auth page —
  // one redirect here covers every child (login, register, reset, mfa, …).
  beforeLoad: async () => {
    await redirectIfAuthenticated();
  },
  // Nested layouts are invisible to the router's component preloader: the
  // layout is rendered inside this route's own component, so its loader warms it.
  loader: () => preloadAuthShell(),
  component: () => (
    <Suspense fallback={<FullPageSpinner />}>
      <AuthLayout>
        <Outlet />
      </AuthLayout>
    </Suspense>
  ),
  errorComponent: RouteErrorBoundary,
});

// ── Public ──
const loginRoute = createRoute({
  getParentRoute: () => authShellRoute,
  path: '/login',
  head: manifestHead(loginManifest),
  validateSearch: validateLoginSearch,
  component: LoginPage,
  errorComponent: RouteErrorBoundary,
});

const mfaRoute = createRoute({
  getParentRoute: () => authShellRoute,
  path: '/mfa',
  head: manifestHead(mfaManifest),
  component: MfaPage,
  errorComponent: RouteErrorBoundary,
});

// One provider-specific OAuth return URL per third party (/callback/google,
// /callback/github, …) — the landing page forwards code+state to the backend.

// ── Public shell ──
// Pathless layout for callback, onboarding, accept-invite, and unauthorized —
// the signed-out canvas without the sign-in form's card or the app shell.
const publicShellRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'public-shell',
  loader: () => PublicLayout.preload?.(),
  component: () => (
    <Suspense fallback={<FullPageSpinner />}>
      <PublicLayout />
    </Suspense>
  ),
  errorComponent: RouteErrorBoundary,
});

const callbackRoute = createRoute({
  getParentRoute: () => publicShellRoute,
  path: '/callback/$provider',
  head: manifestHead(callbackManifest),
  validateSearch: validateCallbackSearch,
  beforeLoad: ({ params }) => {
    if (!parseOAuthProviderParam(params.provider)) throw notFound();
  },
  component: CallbackPage,
  errorComponent: RouteErrorBoundary,
});

const onboardingRoute = createRoute({
  getParentRoute: () => publicShellRoute,
  path: '/onboarding',
  head: manifestHead(onboardingManifest),
  validateSearch: validateOnboardingSearch,
  beforeLoad: async ({ location }) => {
    await requireAuth(location.href);
    await requireOnboardingWorkspace();
  },
  component: OnboardingPage,
  errorComponent: RouteErrorBoundary,
});

const acceptInviteRoute = createRoute({
  getParentRoute: () => publicShellRoute,
  path: '/accept-invite/$invitationId',
  head: manifestHead(acceptInviteManifest),
  beforeLoad: async ({ params, location }) => {
    if (!parseInvitationIdParam(params.invitationId)) throw notFound();
    // Accepting needs a signed-in session whose email matches the invite, and
    // the recipient usually is NOT signed in yet — that is the common path, not
    // the edge case. The page used to check this in a passive effect, so the
    // "Joining…" card painted first and then vanished (INV-4). `requireAuth`
    // awaits the auth bootstrap before deciding, so a cold load of an emailed
    // link does not bounce an already-signed-in user, and `location.href`
    // carries the token back through login.
    await requireAuth(location.href);
  },
  component: AcceptInvitePage,
  errorComponent: RouteErrorBoundary,
});

const unauthorizedRoute = createRoute({
  getParentRoute: () => publicShellRoute,
  path: '/unauthorized',
  head: () => ({ meta: [{ title: composePageTitle('Unauthorized') }] }),
  component: UnauthorizedPage,
  errorComponent: RouteErrorBoundary,
});

// ── Index resolver ──
// `/` keeps no UI: onboarding first, then the active organization's home (the
// member's role home), else the `/organization` picker (routing-and-tenancy.md §2).
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: async ({ location, preload }) => {
    // Resolving `/` triggers fetches and always throws a redirect — pointless
    // (and side-effectful) for hover preloads.
    if (preload) return;
    await requireAuth(location.href);
    throw redirect(await resolveRootRedirect());
  },
  component: () => null,
});

// ── Organization picker (/organization) ──
const organizationPickerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/organization',
  head: manifestHead(organizationPickerManifest),
  beforeLoad: async ({ location, preload }) => {
    if (preload) return;
    await requireAuth(location.href);
    await requireProvisionedWorkspace({ params: {}, redirectFrom: location.href });
  },
  component: OrganizationPickerPage,
  errorComponent: RouteErrorBoundary,
});

// ── Organization shell (/organization/$organizationSlug) ──
// The URL is the single source of truth for organization context: the guard
// chain validates the param, confirms membership (404 otherwise), syncs the
// derived store, and refetches per-organization permissions on change.
const organizationShellRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/organization/$organizationSlug',
  head: manifestHead(organizationShellManifest),
  beforeLoad: async ({ location, params, preload }) => {
    if (preload) return;
    await requireAuth(location.href);
    requireTeamDeployment({ params });
    await requireProvisionedWorkspace({ params, redirectFrom: location.href });
    await resolveActiveOrg({ params });
  },
  // The shell's island (with the AppLayout in it), fetched alongside the
  // route's own chunks rather than after the layout mounts (preloadAppShell);
  // the rooms' module too, without holding the shell for it.
  loader: () => {
    warmRoomRoutes();
    return preloadAppShell(OrganizationShell);
  },
  component: function OrganizationShellRoute() {
    const isLoading = useAuthStore((s) => s.isLoading);
    if (isLoading) return <FullPageSpinner />;
    return (
      <Suspense fallback={<FullPageSpinner />}>
        <OrganizationShell />
      </Suspense>
    );
  },
  errorComponent: RouteErrorBoundary,
});

// Runs the standard leaf gateway (session → module → permission), then the
// INVERSE of `requireOrgStatus`. It stays outside `requireOrgStatus` on purpose
// — a suspended organization must render its blocked state without
// redirect-looping — but "outside" used to mean unguarded in both directions,
// so an active organization could be told it was suspended just by typing the
// URL. `requireSuspendedOrgStatus` closes the other half: the two guards
// partition the status space, so neither can bounce into the other.
const organizationSuspendedRoute = createRoute({
  getParentRoute: () => organizationShellRoute,
  path: 'suspended',
  head: manifestHead(suspendedManifest),
  beforeLoad: async ({ params, preload, location }) => {
    if (preload) return;
    await gatewayFromManifest(suspendedManifest)(toGateContext(location, params));
    requireSuspendedOrgStatus({ params });
  },
  component: SuspendedPage,
  errorComponent: RouteErrorBoundary,
});

// ── Clinic rooms (KICKOFF §4, L-12a) ──
// The leaf pattern: gateway (session → module → permission), then the org
// status guard; the manifest rides along as staticData for the nav (L-12).
// The org home (the index) and an unknown in-org path go to the member's role
// home (D25, S:115) — Today for most roles; `/medical` and `/stock` open on
// their first tab. With no room open to the member — every clinic module off
// (D8: production until each room's API lands) or an access that views none —
// the home renders `AppHomeEmpty` in a room's place: it never redirects
// then, so nothing can loop.
const organizationIndexRoute = createRoute({
  getParentRoute: () => organizationShellRoute,
  path: '/',
  beforeLoad: async ({ params, preload }) => {
    if (preload) return;
    // A suspended organization goes to its blocked state, never to the empty
    // state below — the gate every room runs, run here for the home's own page.
    requireOrgStatus({ params });
    const { appHomeRoute } = await import('@/shared/app/app-home.ts');
    const home = await appHomeRoute(params.organizationSlug);
    if (home) throw redirect(home);
  },
  component: AppHomeEmpty,
  errorComponent: RouteErrorBoundary,
});

const organizationNotFoundRoute = createRoute({
  getParentRoute: () => organizationShellRoute,
  path: '$',
  beforeLoad: async ({ params, preload }) => {
    if (preload) return;
    const [{ appHomeRoute }, { notify }] = await Promise.all([
      import('@/shared/app/app-home.ts'),
      import('@/shared/notify/index.ts'),
    ]);
    notify.info(i18n.t(ERRORS_KEYS.route.pageNotFound, { ns: ERRORS_NS }));
    throw redirect(
      (await appHomeRoute(params.organizationSlug)) ??
        organizationHome(params.organizationSlug),
    );
  },
  component: () => null,
  errorComponent: RouteErrorBoundary,
});

const organizationTodayRoute = createRoute({
  getParentRoute: () => organizationShellRoute,
  path: 'today',
  head: manifestHead(todayManifest),
  staticData: { manifest: todayManifest },
  validateSearch: validateTodaySearch,
  beforeLoad: roomLeafGate(todayManifest),
  component: TodayPage,
  errorComponent: RouteErrorBoundary,
});

const organizationLeadsRoute = createRoute({
  getParentRoute: () => organizationShellRoute,
  path: 'leads',
  head: manifestHead(leadsManifest),
  staticData: { manifest: leadsManifest },
  validateSearch: validateLeadsSearch,
  beforeLoad: roomLeafGate(leadsManifest),
  component: LeadsPage,
  errorComponent: RouteErrorBoundary,
});

// URL-driven dialogs over the Leads list (D24, S:23–24): each renders nothing;
// the list page reads the URL and opens the drawer over itself.
const organizationLeadCreateRoute = createRoute({
  getParentRoute: () => organizationLeadsRoute,
  path: 'create',
  validateSearch: dialogSearch<LeadCreateSearch>(),
  ...dialogRoute('leadCreate'),
});

const organizationLeadRoute = createRoute({
  getParentRoute: () => organizationLeadsRoute,
  path: '$leadId',
  ...dialogRoute('lead'),
});

// Show and edit are one drawer (S:25): the edit URL lands on the lead's,
// keeping the list's filters.
const organizationLeadEditRoute = createRoute({
  getParentRoute: () => organizationLeadsRoute,
  path: '$leadId/edit',
  beforeLoad: ({ params, search }) => {
    throw redirect({ to: organizationLeadRoute.fullPath, params, search });
  },
  component: () => null,
  errorComponent: RouteErrorBoundary,
});

const organizationAppointmentsRoute = createRoute({
  getParentRoute: () => organizationShellRoute,
  path: 'appointments',
  head: manifestHead(appointmentsManifest),
  staticData: { manifest: appointmentsManifest },
  validateSearch: validateAppointmentsSearch,
  beforeLoad: roomLeafGate(appointmentsManifest),
  component: AppointmentsPage,
  errorComponent: RouteErrorBoundary,
});

// URL-driven dialogs over the Appointments page (D24, S:27–28): each renders
// nothing; the page reads the URL and opens the appointment form over itself.
const organizationAppointmentCreateRoute = createRoute({
  getParentRoute: () => organizationAppointmentsRoute,
  path: 'create',
  validateSearch: dialogSearch<AppointmentCreateSearch>(),
  ...dialogRoute('appointmentCreate'),
});

const organizationAppointmentRoute = createRoute({
  getParentRoute: () => organizationAppointmentsRoute,
  path: '$appointmentId',
  validateSearch: dialogSearch<AppointmentSearch>(),
  ...dialogRoute('appointment'),
});

// Show is edit (S:29): the edit URL lands on the booking's, keeping the page's
// filters and the drawer's params.
const organizationAppointmentEditRoute = createRoute({
  getParentRoute: () => organizationAppointmentsRoute,
  path: '$appointmentId/edit',
  beforeLoad: ({ params, search }) => {
    throw redirect({ to: organizationAppointmentRoute.fullPath, params, search });
  },
  component: () => null,
  errorComponent: RouteErrorBoundary,
});

const organizationPatientsRoute = createRoute({
  getParentRoute: () => organizationShellRoute,
  path: 'patients',
  head: manifestHead(patientsManifest),
  staticData: { manifest: patientsManifest },
  validateSearch: validatePatientsSearch,
  beforeLoad: roomLeafGate(patientsManifest),
  component: PatientsPage,
  errorComponent: RouteErrorBoundary,
});

// URL-driven dialog over the Patients list (D24, S:31): it renders nothing;
// the list page reads the URL and opens the New patient drawer over itself.
const organizationPatientCreateRoute = createRoute({
  getParentRoute: () => organizationPatientsRoute,
  path: 'create',
  validateSearch: dialogSearch<PatientCreateSearch>(),
  ...dialogRoute('patientCreate'),
});

// The patient file (KICKOFF §4, §6.6): a layout of its own beside the list,
// gated like the room; its sections and dialog routes inherit the gate, and
// in-room access is `useAppAccess` (D9).
const organizationPatientFileRoute = createRoute({
  getParentRoute: () => organizationShellRoute,
  path: 'patients/$patientId',
  head: manifestHead(patientFileManifest),
  // One room: a move between its sections keeps the file still (feat-payment-celebration D13).
  staticData: { manifest: patientFileManifest, room: true },
  validateSearch: validatePatientFileSearch,
  beforeLoad: roomLeafGate(patientFileManifest),
  component: patientFileComponent('PatientFileLayout'),
  errorComponent: RouteErrorBoundary,
});

// `/patients/$patientId` and an unknown section open the Overview (D19; S:33),
// the search kept — the Patients row's and ⌘K's `activity`.
function toPatientFileDefault({
  params,
  search,
}: {
  params: { organizationSlug: string; patientId: string };
  search: PatientFileSearch;
}): never {
  throw redirect({
    to: '/organization/$organizationSlug/patients/$patientId/timeline',
    params,
    search,
  });
}

const organizationPatientFileIndexRoute = createRoute({
  getParentRoute: () => organizationPatientFileRoute,
  path: '/',
  beforeLoad: toPatientFileDefault,
  component: () => null,
  errorComponent: RouteErrorBoundary,
});

const organizationPatientFileUnknownRoute = createRoute({
  getParentRoute: () => organizationPatientFileRoute,
  path: '$',
  beforeLoad: toPatientFileDefault,
  component: () => null,
  errorComponent: RouteErrorBoundary,
});

// A section of the file under its layout (KICKOFF §6.6, S:33). One call per
// section keeps each route's literal path for the typed links, and the entry
// chunk small.
function patientFileSectionRoute<const Section extends PatientFileSectionSlug>(
  path: Section,
) {
  return createRoute({
    getParentRoute: () => organizationPatientFileRoute,
    path,
    component: patientFileSection(path),
    errorComponent: RouteErrorBoundary,
  });
}

const organizationPatientTimelineRoute = patientFileSectionRoute('timeline');
const organizationPatientOverviewRoute = patientFileSectionRoute('overview');
const organizationPatientVisitsRoute = patientFileSectionRoute('visits');
const organizationPatientPrescriptionsRoute = patientFileSectionRoute('prescriptions');
const organizationPatientTreatmentsRoute = patientFileSectionRoute('treatments');
// Photos carries its album and visit filter (`?album=&appointment=`), which
// its viewer and Photo details keep (S:41–42).
const organizationPatientImagesRoute = createRoute({
  getParentRoute: () => organizationPatientFileRoute,
  path: 'images',
  validateSearch: validatePatientImagesSearch,
  component: patientFileSection('images'),
  errorComponent: RouteErrorBoundary,
});
const organizationPatientReportsRoute = patientFileSectionRoute('reports');
const organizationPatientInvoicesRoute = patientFileSectionRoute('invoices');
const organizationPatientPaymentsRoute = patientFileSectionRoute('payments');
const organizationPatientPackagesRoute = patientFileSectionRoute('packages');
const organizationPatientNotesRoute = patientFileSectionRoute('notes');

// URL-driven dialogs over the section they opened from (S:34, 44–47; A-F1):
// each drawer route renders that section (`?from=`) and its drawer over it —
// Edit patient, and the check-in and review drawers.
function patientFileDrawerRoute<const Path extends string, Search>(
  path: Path,
  component: keyof PatientFileRoutes,
  validateSearch: (search: Record<string, unknown>) => Search,
) {
  return createRoute({
    getParentRoute: () => organizationPatientFileRoute,
    path,
    validateSearch,
    staticData: DIALOG_STATIC_DATA,
    component: patientFileComponent(component),
    errorComponent: RouteErrorBoundary,
  });
}

const organizationPatientEditRoute = patientFileDrawerRoute(
  'edit',
  'PatientFileEdit',
  dialogSearch<PatientFileDialogSearch>(),
);
const organizationCheckInCreateRoute = patientFileDrawerRoute(
  'check-ins/create',
  'PatientCheckInCreate',
  dialogSearch<PatientFeedbackDialogSearch>(),
);
const organizationCheckInEditRoute = patientFileDrawerRoute(
  'check-ins/$checkInId/edit',
  'PatientCheckInEdit',
  dialogSearch<PatientFeedbackDialogSearch>(),
);
const organizationReviewCreateRoute = patientFileDrawerRoute(
  'reviews/create',
  'PatientReviewCreate',
  dialogSearch<PatientFeedbackDialogSearch>(),
);
const organizationReviewEditRoute = patientFileDrawerRoute(
  'reviews/$reviewId/edit',
  'PatientReviewEdit',
  dialogSearch<PatientFeedbackDialogSearch>(),
);

// The photo viewer and Photo details, dialogs over Photos (S:41–42).
const organizationPatientPhotoRoute = createRoute({
  getParentRoute: () => organizationPatientImagesRoute,
  path: '$imageId',
  staticData: DIALOG_STATIC_DATA,
  component: patientFileComponent('PatientPhotoViewer'),
  errorComponent: RouteErrorBoundary,
});

const organizationPatientPhotoEditRoute = createRoute({
  getParentRoute: () => organizationPatientImagesRoute,
  path: '$imageId/edit',
  staticData: DIALOG_STATIC_DATA,
  component: patientFileComponent('PatientPhotoDetails'),
  errorComponent: RouteErrorBoundary,
});

// The record dialogs over Prescriptions, Treatments and Reports (S:35–43):
// each renders nothing — the section reads the URL and opens its drawer.
const organizationPrescriptionCreateRoute = createRoute({
  getParentRoute: () => organizationPatientPrescriptionsRoute,
  path: 'create',
  // `?medicines=` — the names a smart note recognised (AMBER A-F5).
  validateSearch: dialogSearch<PatientRxCreateSearch>(),
  staticData: DIALOG_STATIC_DATA,
  component: patientFileDialog('prescriptionCreate'),
  errorComponent: RouteErrorBoundary,
});
const organizationPrescriptionRoute = createRoute({
  getParentRoute: () => organizationPatientPrescriptionsRoute,
  path: '$prescriptionId',
  staticData: DIALOG_STATIC_DATA,
  component: patientFileDialog('prescription'),
  errorComponent: RouteErrorBoundary,
});
const organizationPrescriptionEditRoute = createRoute({
  getParentRoute: () => organizationPatientPrescriptionsRoute,
  path: '$prescriptionId/edit',
  staticData: DIALOG_STATIC_DATA,
  component: patientFileDialog('prescriptionEdit'),
  errorComponent: RouteErrorBoundary,
});
const organizationTreatmentCreateRoute = createRoute({
  getParentRoute: () => organizationPatientTreatmentsRoute,
  path: 'create',
  staticData: DIALOG_STATIC_DATA,
  component: patientFileDialog('treatmentCreate'),
  errorComponent: RouteErrorBoundary,
});
const organizationTreatmentEditRoute = createRoute({
  getParentRoute: () => organizationPatientTreatmentsRoute,
  path: '$treatmentId/edit',
  staticData: DIALOG_STATIC_DATA,
  component: patientFileDialog('treatmentEdit'),
  errorComponent: RouteErrorBoundary,
});
const organizationReportCreateRoute = createRoute({
  getParentRoute: () => organizationPatientReportsRoute,
  path: 'create',
  staticData: DIALOG_STATIC_DATA,
  component: patientFileDialog('reportCreate'),
  errorComponent: RouteErrorBoundary,
});
const organizationReportRoute = createRoute({
  getParentRoute: () => organizationPatientReportsRoute,
  path: '$reportId',
  staticData: DIALOG_STATIC_DATA,
  component: patientFileDialog('report'),
  errorComponent: RouteErrorBoundary,
});

// `/payments` is the ledger itself (D24, `S:84`); its drawers are URL-driven
// dialogs over it — each renders nothing, the page reads the URL and opens it.
const organizationPaymentsRoute = createRoute({
  getParentRoute: () => organizationShellRoute,
  path: 'payments',
  head: manifestHead(paymentsManifest),
  staticData: { manifest: paymentsManifest },
  validateSearch: validatePaymentsSearch,
  beforeLoad: roomLeafGate(paymentsManifest),
  component: PaymentsPage,
  errorComponent: RouteErrorBoundary,
});

const organizationPaymentReceiveRoute = createRoute({
  getParentRoute: () => organizationPaymentsRoute,
  path: 'receive',
  validateSearch: dialogSearch<PaymentReceiveSearch>(),
  ...dialogRoute('paymentReceive'),
});

const organizationPaymentPayRoute = createRoute({
  getParentRoute: () => organizationPaymentsRoute,
  path: 'pay',
  validateSearch: dialogSearch<PaymentPaySearch>(),
  ...dialogRoute('paymentPay'),
});

const organizationPaymentEditRoute = createRoute({
  getParentRoute: () => organizationPaymentsRoute,
  path: '$paymentId/edit',
  ...dialogRoute('paymentEdit'),
});

const organizationDayCloseRoute = createRoute({
  getParentRoute: () => organizationPaymentsRoute,
  path: 'day-close',
  validateSearch: dialogSearch<DayCloseSearch>(),
  ...dialogRoute('dayClose'),
});

// Payments › Pending (`S:88`): the room's second tab, a page of its own — a
// sibling of the ledger in the tree, a child folder on disk.
const organizationPaymentsPendingRoute = createRoute({
  getParentRoute: () => organizationShellRoute,
  path: 'payments/pending',
  head: manifestHead(pendingManifest),
  staticData: { manifest: pendingManifest },
  validateSearch: validatePendingSearch,
  beforeLoad: roomLeafGate(pendingManifest),
  component: PaymentsPendingPage,
  errorComponent: RouteErrorBoundary,
});

// Add pending's `?direction=give|take` (`S:89`) is Pending's own `direction`
// filter (`S:88`) — one key, read by both.
const organizationPendingCreateRoute = createRoute({
  getParentRoute: () => organizationPaymentsPendingRoute,
  path: 'create',
  ...dialogRoute('pendingCreate'),
});

const organizationCreditEditRoute = createRoute({
  getParentRoute: () => organizationPaymentsPendingRoute,
  path: '$creditId/edit',
  ...dialogRoute('creditEdit'),
});

// The shared Invoice drawer (`S:92–94`, D24; KICKOFF §4, §6.9). Its routes are
// dialogs over a referrer: the Payments ledger — the island's default
// referrer — stands behind them, its outlet holding the dialog routes (which
// render nothing), and the island's host opens each dialog over it; `from`
// takes the drawer back to the room that opened it.
const InvoicesHost = roomRoute('InvoicesHost');

const organizationInvoicesRoute = createRoute({
  getParentRoute: () => organizationShellRoute,
  path: 'invoices',
  head: manifestHead(invoicesManifest),
  validateSearch: validateInvoiceSearch,
  beforeLoad: roomLeafGate(invoicesManifest),
  // Both render inside this route's own component, out of the router's chunk
  // preloader's sight — warmed here so neither suspends on `use()` (preloadAppShell).
  loader: () => Promise.all([PaymentsPage.preload?.(), InvoicesHost.preload?.()]),
  // The Payments ledger behind, the island's dialog host over it.
  component: () => (
    <>
      <PaymentsPage />
      <InvoicesHost />
    </>
  ),
  errorComponent: RouteErrorBoundary,
});

const organizationInvoiceCreateRoute = createRoute({
  getParentRoute: () => organizationInvoicesRoute,
  path: 'create',
  validateSearch: dialogSearch<InvoiceCreateSearch>(),
  ...dialogRoute('invoiceCreate'),
});

const organizationInvoiceRoute = createRoute({
  getParentRoute: () => organizationInvoicesRoute,
  path: '$invoiceId',
  ...dialogRoute('invoice'),
});

const organizationInvoiceEditRoute = createRoute({
  getParentRoute: () => organizationInvoiceRoute,
  path: 'edit',
  ...dialogRoute('invoiceEdit'),
});

// An old Visit sheet link (`visits/$visitId?tab=…`; the sheet is gone, L-64):
// a pure redirect, like `/` — to the visit's patient's page with the visit
// flow open (`timeline?visit=open&from=today`), or Today with "Visit not
// found". The resolver loads on demand.
const organizationVisitRedirectRoute = createRoute({
  getParentRoute: () => organizationShellRoute,
  path: 'visits/$visitId',
  beforeLoad: async ({ params, preload }) => {
    if (preload) return;
    const { visitRedirect } = await import('@/shared/app/visit-redirect.ts');
    throw redirect(await visitRedirect(params.organizationSlug, params.visitId));
  },
  component: () => null,
  errorComponent: RouteErrorBoundary,
});

const organizationTasksRoute = createRoute({
  getParentRoute: () => organizationShellRoute,
  path: 'tasks',
  head: manifestHead(tasksManifest),
  staticData: { manifest: tasksManifest },
  validateSearch: validateTasksSearch,
  beforeLoad: roomLeafGate(tasksManifest),
  component: TasksPage,
  errorComponent: RouteErrorBoundary,
});

// URL-driven dialog over the Tasks list (D24, S:96, Q-T4): it renders nothing;
// the list page reads the URL and opens the New task drawer over itself.
const organizationTaskCreateRoute = createRoute({
  getParentRoute: () => organizationTasksRoute,
  path: 'create',
  validateSearch: dialogSearch<TaskCreateSearch>(),
  ...dialogRoute('taskCreate'),
});

// URL-driven dialog over the Tasks list (D24, S:97): it renders nothing; the
// list page reads the URL and opens the task drawer over itself.
const organizationTaskRoute = createRoute({
  getParentRoute: () => organizationTasksRoute,
  path: '$taskId',
  ...dialogRoute('task'),
});

const organizationOfferingsRoute = createRoute({
  getParentRoute: () => organizationShellRoute,
  path: 'offerings',
  head: manifestHead(offeringsManifest),
  staticData: { manifest: offeringsManifest },
  validateSearch: validateOfferingsSearch,
  beforeLoad: roomLeafGate(offeringsManifest),
  component: OfferingsPage,
  errorComponent: RouteErrorBoundary,
});

// URL-driven dialogs over the Offerings tab (D24, S:99–100): they render
// nothing; the list page reads the URL and opens the Offering drawer over itself.
const organizationOfferingCreateRoute = createRoute({
  getParentRoute: () => organizationOfferingsRoute,
  path: 'create',
  validateSearch: dialogSearch<OfferingCreateSearch>(),
  ...dialogRoute('offeringCreate'),
});

const organizationOfferingEditRoute = createRoute({
  getParentRoute: () => organizationOfferingsRoute,
  path: '$offeringId/edit',
  ...dialogRoute('offeringEdit'),
});

// The room's tabs are literal child URLs (D24, S:101). The Offers tab is a page
// of its own, so it sits beside the Offerings tab rather than inside its outlet.
const organizationOffersRoute = createRoute({
  getParentRoute: () => organizationShellRoute,
  path: 'offerings/offers',
  head: manifestHead(offersManifest),
  staticData: { manifest: offersManifest },
  validateSearch: validateOffersSearch,
  beforeLoad: roomLeafGate(offersManifest),
  component: OffersPage,
  errorComponent: RouteErrorBoundary,
});

// URL-driven dialogs over the Offers tab (D24, S:102–103): they render nothing;
// the Offers page reads the URL and opens the Offer drawer over itself.
const organizationOfferCreateRoute = createRoute({
  getParentRoute: () => organizationOffersRoute,
  path: 'create',
  ...dialogRoute('offerCreate'),
});

const organizationOfferEditRoute = createRoute({
  getParentRoute: () => organizationOffersRoute,
  path: '$offerId/edit',
  ...dialogRoute('offerEdit'),
});

const organizationUsersRoute = createRoute({
  getParentRoute: () => organizationShellRoute,
  path: 'users',
  head: manifestHead(usersManifest),
  staticData: { manifest: usersManifest },
  validateSearch: validateUsersSearch,
  beforeLoad: roomLeafGate(usersManifest),
  component: UsersPage,
  errorComponent: RouteErrorBoundary,
});

// URL-driven dialogs over the Team (D24, S:105–106): each renders nothing; the
// Users page reads the URL and opens the user drawer over itself.
const organizationUserCreateRoute = createRoute({
  getParentRoute: () => organizationUsersRoute,
  path: 'create',
  ...dialogRoute('userCreate'),
});

const organizationUserEditRoute = createRoute({
  getParentRoute: () => organizationUsersRoute,
  path: '$userId/edit',
  // `?from=roles` keeps Roles & access behind the drawer (H:5188).
  validateSearch: dialogSearch<UserEditSearch>(),
  ...dialogRoute('userEdit'),
});

// Roles & access sits beside the Team, not under it: the Team route renders
// the Team, and this tab is a page of its own (`S:107`).
const organizationUsersRolesRoute = createRoute({
  getParentRoute: () => organizationShellRoute,
  path: 'users/roles',
  head: manifestHead(usersRolesManifest),
  staticData: { manifest: usersRolesManifest },
  validateSearch: validateRolesSearch,
  beforeLoad: roomLeafGate(usersRolesManifest),
  component: UsersRolesPage,
  errorComponent: RouteErrorBoundary,
});

// Branches — its own room in the primary nav (`S:108`; change-branches-in-navbar);
// its drawers are URL-driven dialogs over the list (D24, S:109–110).
const organizationBranchesRoute = createRoute({
  getParentRoute: () => organizationShellRoute,
  path: 'branches',
  head: manifestHead(branchesManifest),
  staticData: { manifest: branchesManifest },
  validateSearch: validateBranchesSearch,
  beforeLoad: roomLeafGate(branchesManifest),
  component: BranchesPage,
  errorComponent: RouteErrorBoundary,
});

const organizationBranchCreateRoute = createRoute({
  getParentRoute: () => organizationBranchesRoute,
  path: 'create',
  ...dialogRoute('branchCreate'),
});

const organizationBranchEditRoute = createRoute({
  getParentRoute: () => organizationBranchesRoute,
  path: '$branchId/edit',
  ...dialogRoute('branchEdit'),
});

// Branches' old home, Users › Branches (before change-branches-in-navbar): a pure
// redirect, like `/`, to the same place in the Branches room — a drawer
// (`create`, `$branchId/edit`), the search and the hash (Settings) kept — so a
// bookmark or a shared link still opens the same thing.
const organizationUsersBranchesRedirectRoute = createRoute({
  getParentRoute: () => organizationShellRoute,
  path: 'users/branches/$',
  beforeLoad: async ({ params, preload }) => {
    if (preload) return;
    const { redirectFromUsersBranches } = await import('@/shared/app/app-home.ts');
    redirectFromUsersBranches(params);
  },
  errorComponent: RouteErrorBoundary,
});

const organizationMedicalRoute = createRoute({
  getParentRoute: () => organizationShellRoute,
  path: 'medical',
  head: manifestHead(medicalManifest),
  staticData: { manifest: medicalManifest },
  beforeLoad: async ({ params, preload, location }) => {
    if (preload) return;
    await gatewayFromManifest(medicalManifest)(toGateContext(location, params));
  },
  component: MedicalLayout,
  errorComponent: RouteErrorBoundary,
});

const organizationMedicalIndexRoute = createRoute({
  getParentRoute: () => organizationMedicalRoute,
  path: '/',
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/organization/$organizationSlug/medical/sales',
      params: { organizationSlug: params.organizationSlug },
    });
  },
  component: () => null,
  errorComponent: RouteErrorBoundary,
});

/**
 * A clinic leaf's gate (KICKOFF §4): the manifest's gateway (session → module
 * → permission), then the org status guard — one function for the rooms' pages
 * and tabs, and for every dialog route, whose manifest it awaits first
 * (`dialogRoute`).
 */
function roomLeafGate(manifest: PageManifest | (() => Promise<PageManifest>)) {
  return async ({
    params,
    preload,
    location,
  }: {
    params: Record<string, string>;
    preload: boolean;
    location: Parameters<typeof toGateContext>[0];
  }) => {
    if (preload) return;
    const policy = typeof manifest === 'function' ? await manifest() : manifest;
    await gatewayFromManifest(policy)(toGateContext(location, params));
    requireOrgStatus({ params });
  };
}

// The Medical tabs (D24, S:49–71): each a page; its dialogs below.
const organizationMedicalSalesRoute = createRoute({
  getParentRoute: () => organizationMedicalRoute,
  path: 'sales',
  head: manifestHead(medicalSalesManifest),
  validateSearch: validateMedicalSearch,
  beforeLoad: roomLeafGate(medicalSalesManifest),
  component: MedicalSalesPage,
  errorComponent: RouteErrorBoundary,
});

const organizationMedicalMedicinesRoute = createRoute({
  getParentRoute: () => organizationMedicalRoute,
  path: 'medicines',
  head: manifestHead(medicalMedicinesManifest),
  validateSearch: validateMedicalSearch,
  beforeLoad: roomLeafGate(medicalMedicinesManifest),
  component: MedicalMedicinesPage,
  errorComponent: RouteErrorBoundary,
});

const organizationMedicalPurchasesRoute = createRoute({
  getParentRoute: () => organizationMedicalRoute,
  path: 'purchases',
  head: manifestHead(medicalPurchasesManifest),
  validateSearch: validateMedicalSearch,
  beforeLoad: roomLeafGate(medicalPurchasesManifest),
  component: MedicalPurchasesPage,
  errorComponent: RouteErrorBoundary,
});

const organizationMedicalSuppliersRoute = createRoute({
  getParentRoute: () => organizationMedicalRoute,
  path: 'suppliers',
  head: manifestHead(medicalSuppliersManifest),
  validateSearch: validateMedicalSearch,
  beforeLoad: roomLeafGate(medicalSuppliersManifest),
  component: MedicalSuppliersPage,
  errorComponent: RouteErrorBoundary,
});

const organizationMedicalManufacturersRoute = createRoute({
  getParentRoute: () => organizationMedicalRoute,
  path: 'manufacturers',
  head: manifestHead(medicalManufacturersManifest),
  validateSearch: validateMedicalSearch,
  beforeLoad: roomLeafGate(medicalManufacturersManifest),
  component: MedicalManufacturersPage,
  errorComponent: RouteErrorBoundary,
});

const organizationMedicalMrsRoute = createRoute({
  getParentRoute: () => organizationMedicalRoute,
  path: 'mrs',
  head: manifestHead(medicalMrsManifest),
  validateSearch: validateMedicalSearch,
  beforeLoad: roomLeafGate(medicalMrsManifest),
  component: MedicalMrsPage,
  errorComponent: RouteErrorBoundary,
});

const organizationMedicalPaymentsRoute = createRoute({
  getParentRoute: () => organizationMedicalRoute,
  path: 'payments',
  head: manifestHead(medicalPaymentsManifest),
  validateSearch: validateMedicalPaymentsSearch,
  beforeLoad: roomLeafGate(medicalPaymentsManifest),
  component: MedicalPaymentsPage,
  errorComponent: RouteErrorBoundary,
});

const organizationMedicalCreditsRoute = createRoute({
  getParentRoute: () => organizationMedicalRoute,
  path: 'credits',
  head: manifestHead(medicalCreditsManifest),
  validateSearch: validateMedicalCreditsSearch,
  beforeLoad: roomLeafGate(medicalCreditsManifest),
  component: MedicalCreditsPage,
  errorComponent: RouteErrorBoundary,
});

// URL-driven dialogs over the Medical tabs (D24, S:50–70): each renders
// nothing; the tab page reads the URL and opens the drawer over itself.
const organizationSaleCreateRoute = createRoute({
  getParentRoute: () => organizationMedicalSalesRoute,
  path: 'create',
  validateSearch: dialogSearch<MedicalCreateSearch>(),
  ...dialogRoute('saleCreate'),
});

const organizationSaleRoute = createRoute({
  getParentRoute: () => organizationMedicalSalesRoute,
  path: '$saleId',
  ...dialogRoute('sale'),
});

const organizationSaleReturnRoute = createRoute({
  getParentRoute: () => organizationSaleRoute,
  path: 'return',
  ...dialogRoute('saleReturn'),
});

const organizationMedicineCreateRoute = createRoute({
  getParentRoute: () => organizationMedicalMedicinesRoute,
  path: 'create',
  validateSearch: dialogSearch<MedicalCreateSearch>(),
  ...dialogRoute('medicineCreate'),
});

const organizationMedicineEditRoute = createRoute({
  getParentRoute: () => organizationMedicalMedicinesRoute,
  path: '$medicineId/edit',
  ...dialogRoute('medicineEdit'),
});

const organizationPurchaseOrderCreateRoute = createRoute({
  getParentRoute: () => organizationMedicalPurchasesRoute,
  path: 'create',
  validateSearch: dialogSearch<MedicalCreateSearch>(),
  ...dialogRoute('purchaseOrderCreate'),
});

const organizationPurchaseOrderRoute = createRoute({
  getParentRoute: () => organizationMedicalPurchasesRoute,
  path: '$purchaseOrderId',
  ...dialogRoute('purchaseOrder'),
});

const organizationPurchaseOrderEditRoute = createRoute({
  getParentRoute: () => organizationPurchaseOrderRoute,
  path: 'edit',
  ...dialogRoute('purchaseOrderEdit'),
});

const organizationPurchaseOrderReceiveRoute = createRoute({
  getParentRoute: () => organizationPurchaseOrderRoute,
  path: 'receive',
  ...dialogRoute('purchaseOrderReceive'),
});

const organizationSupplierCreateRoute = createRoute({
  getParentRoute: () => organizationMedicalSuppliersRoute,
  path: 'create',
  ...dialogRoute('supplierCreate'),
});

const organizationSupplierEditRoute = createRoute({
  getParentRoute: () => organizationMedicalSuppliersRoute,
  path: '$supplierId/edit',
  ...dialogRoute('supplierEdit'),
});

const organizationManufacturerCreateRoute = createRoute({
  getParentRoute: () => organizationMedicalManufacturersRoute,
  path: 'create',
  ...dialogRoute('manufacturerCreate'),
});

const organizationManufacturerEditRoute = createRoute({
  getParentRoute: () => organizationMedicalManufacturersRoute,
  path: '$manufacturerId/edit',
  ...dialogRoute('manufacturerEdit'),
});

const organizationMrCreateRoute = createRoute({
  getParentRoute: () => organizationMedicalMrsRoute,
  path: 'create',
  ...dialogRoute('mrCreate'),
});

const organizationMrEditRoute = createRoute({
  getParentRoute: () => organizationMedicalMrsRoute,
  path: '$mrId/edit',
  ...dialogRoute('mrEdit'),
});

const organizationMrVisitCreateRoute = createRoute({
  getParentRoute: () => organizationMedicalMrsRoute,
  path: '$mrId/visits/create',
  ...dialogRoute('mrVisitCreate'),
});

const organizationStockRoute = createRoute({
  getParentRoute: () => organizationShellRoute,
  path: 'stock',
  head: manifestHead(stockManifest),
  staticData: { manifest: stockManifest },
  beforeLoad: async ({ params, preload, location }) => {
    if (preload) return;
    await gatewayFromManifest(stockManifest)(toGateContext(location, params));
  },
  component: StockLayout,
  errorComponent: RouteErrorBoundary,
});

const organizationStockIndexRoute = createRoute({
  getParentRoute: () => organizationStockRoute,
  path: '/',
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/organization/$organizationSlug/stock/items',
      params: { organizationSlug: params.organizationSlug },
    });
  },
  component: () => null,
  errorComponent: RouteErrorBoundary,
});

// The Clinic stock tabs (D24, S:72–83): each a page; its dialogs below.
const organizationStockItemsRoute = createRoute({
  getParentRoute: () => organizationStockRoute,
  path: 'items',
  head: manifestHead(stockItemsManifest),
  validateSearch: validateStockSearch,
  beforeLoad: roomLeafGate(stockItemsManifest),
  component: StockItemsPage,
  errorComponent: RouteErrorBoundary,
});

const organizationStockPurchasesRoute = createRoute({
  getParentRoute: () => organizationStockRoute,
  path: 'purchases',
  head: manifestHead(stockPurchasesManifest),
  validateSearch: validateStockSearch,
  beforeLoad: roomLeafGate(stockPurchasesManifest),
  component: StockPurchasesPage,
  errorComponent: RouteErrorBoundary,
});

const organizationStockMovementsRoute = createRoute({
  getParentRoute: () => organizationStockRoute,
  path: 'movements',
  head: manifestHead(stockMovementsManifest),
  validateSearch: validateStockSearch,
  beforeLoad: roomLeafGate(stockMovementsManifest),
  component: StockMovementsPage,
  errorComponent: RouteErrorBoundary,
});

const organizationStockVendorsRoute = createRoute({
  getParentRoute: () => organizationStockRoute,
  path: 'vendors',
  head: manifestHead(stockVendorsManifest),
  validateSearch: validateStockSearch,
  beforeLoad: roomLeafGate(stockVendorsManifest),
  component: StockVendorsPage,
  errorComponent: RouteErrorBoundary,
});

// URL-driven dialogs over the Clinic stock tabs (D24, S:74–83): each renders
// nothing; the tab page reads the URL and opens the drawer over itself.
const organizationStockItemCreateRoute = createRoute({
  getParentRoute: () => organizationStockItemsRoute,
  path: 'create',
  validateSearch: dialogSearch<StockCreateSearch>(),
  ...dialogRoute('stockItemCreate'),
});

const organizationStockItemEditRoute = createRoute({
  getParentRoute: () => organizationStockItemsRoute,
  path: '$itemId/edit',
  ...dialogRoute('stockItemEdit'),
});

const organizationStockCheckRoute = createRoute({
  getParentRoute: () => organizationStockItemsRoute,
  path: 'check',
  ...dialogRoute('stockCheck'),
});

const organizationStockPurchaseCreateRoute = createRoute({
  getParentRoute: () => organizationStockPurchasesRoute,
  path: 'create',
  validateSearch: dialogSearch<StockCreateSearch>(),
  ...dialogRoute('stockPurchaseCreate'),
});

const organizationStockPurchaseEditRoute = createRoute({
  getParentRoute: () => organizationStockPurchasesRoute,
  path: '$purchaseId/edit',
  ...dialogRoute('stockPurchaseEdit'),
});

const organizationStockVendorCreateRoute = createRoute({
  getParentRoute: () => organizationStockVendorsRoute,
  path: 'create',
  validateSearch: dialogSearch<StockCreateSearch>(),
  ...dialogRoute('stockVendorCreate'),
});

const organizationStockVendorEditRoute = createRoute({
  getParentRoute: () => organizationStockVendorsRoute,
  path: '$vendorId/edit',
  ...dialogRoute('stockVendorEdit'),
});

// ── The retired `/dashboard` ──
// The old dashboard is gone (L-63) and personal workspaces are off (D44), so
// the personal space's URL — a bookmark, an installed app's last page — now
// resolves as `/` does: the active clinic's home, else the organization picker,
// where a personal workspace lands (its list and "Create organization" lead
// into a clinic, so it is never a dead end).
const retiredDashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  beforeLoad: ({ preload }) => {
    if (preload) return;
    throw redirect({ to: '/' });
  },
  component: () => null,
  errorComponent: RouteErrorBoundary,
});

// Settings is no longer a route space: the global SettingsModal (mounted on
// the root route) is driven by the URL hash — #settings/<scope>/<section> —
// so it overlays any page without unmounting it. See
// shared/components/SettingsModal/ and routing-and-tenancy.md §7.

// ── 404 ──
const notFoundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '$',
  head: () => ({ meta: [{ title: composePageTitle('Page not found') }] }),
  component: NotFoundPage,
  errorComponent: RouteErrorBoundary,
});

// ── Tree ──
const routeTree = rootRoute.addChildren([
  indexRoute,
  authShellRoute.addChildren([loginRoute, mfaRoute]),
  publicShellRoute.addChildren([
    callbackRoute,
    onboardingRoute,
    acceptInviteRoute,
    unauthorizedRoute,
  ]),
  organizationPickerRoute,
  organizationShellRoute.addChildren([
    organizationIndexRoute,
    organizationSuspendedRoute,
    organizationTodayRoute,
    organizationLeadsRoute.addChildren([
      organizationLeadCreateRoute,
      organizationLeadRoute,
      organizationLeadEditRoute,
    ]),
    organizationAppointmentsRoute.addChildren([
      organizationAppointmentCreateRoute,
      organizationAppointmentRoute,
      organizationAppointmentEditRoute,
    ]),
    organizationPatientsRoute.addChildren([organizationPatientCreateRoute]),
    organizationPatientFileRoute.addChildren([
      organizationPatientFileIndexRoute,
      organizationPatientTimelineRoute,
      organizationPatientOverviewRoute,
      organizationPatientVisitsRoute,
      organizationPatientPrescriptionsRoute.addChildren([
        organizationPrescriptionCreateRoute,
        organizationPrescriptionRoute,
        organizationPrescriptionEditRoute,
      ]),
      organizationPatientTreatmentsRoute.addChildren([
        organizationTreatmentCreateRoute,
        organizationTreatmentEditRoute,
      ]),
      organizationPatientImagesRoute.addChildren([
        organizationPatientPhotoRoute,
        organizationPatientPhotoEditRoute,
      ]),
      organizationPatientReportsRoute.addChildren([
        organizationReportCreateRoute,
        organizationReportRoute,
      ]),
      organizationPatientInvoicesRoute,
      organizationPatientPaymentsRoute,
      organizationPatientPackagesRoute,
      organizationPatientNotesRoute,
      organizationPatientEditRoute,
      organizationCheckInCreateRoute,
      organizationCheckInEditRoute,
      organizationReviewCreateRoute,
      organizationReviewEditRoute,
      organizationPatientFileUnknownRoute,
    ]),
    organizationMedicalRoute.addChildren([
      organizationMedicalIndexRoute,
      organizationMedicalSalesRoute.addChildren([
        organizationSaleCreateRoute,
        organizationSaleRoute.addChildren([organizationSaleReturnRoute]),
      ]),
      organizationMedicalMedicinesRoute.addChildren([
        organizationMedicineCreateRoute,
        organizationMedicineEditRoute,
      ]),
      organizationMedicalPurchasesRoute.addChildren([
        organizationPurchaseOrderCreateRoute,
        organizationPurchaseOrderRoute.addChildren([
          organizationPurchaseOrderEditRoute,
          organizationPurchaseOrderReceiveRoute,
        ]),
      ]),
      organizationMedicalSuppliersRoute.addChildren([
        organizationSupplierCreateRoute,
        organizationSupplierEditRoute,
      ]),
      organizationMedicalManufacturersRoute.addChildren([
        organizationManufacturerCreateRoute,
        organizationManufacturerEditRoute,
      ]),
      organizationMedicalMrsRoute.addChildren([
        organizationMrCreateRoute,
        organizationMrEditRoute,
        organizationMrVisitCreateRoute,
      ]),
      organizationMedicalPaymentsRoute,
      organizationMedicalCreditsRoute,
    ]),
    organizationStockRoute.addChildren([
      organizationStockIndexRoute,
      organizationStockItemsRoute.addChildren([
        organizationStockItemCreateRoute,
        organizationStockItemEditRoute,
        organizationStockCheckRoute,
      ]),
      organizationStockPurchasesRoute.addChildren([
        organizationStockPurchaseCreateRoute,
        organizationStockPurchaseEditRoute,
      ]),
      organizationStockMovementsRoute,
      organizationStockVendorsRoute.addChildren([
        organizationStockVendorCreateRoute,
        organizationStockVendorEditRoute,
      ]),
    ]),
    organizationPaymentsRoute.addChildren([
      organizationPaymentReceiveRoute,
      organizationPaymentPayRoute,
      organizationPaymentEditRoute,
      organizationDayCloseRoute,
    ]),
    organizationPaymentsPendingRoute.addChildren([
      organizationPendingCreateRoute,
      organizationCreditEditRoute,
    ]),
    organizationInvoicesRoute.addChildren([
      organizationInvoiceCreateRoute,
      organizationInvoiceRoute.addChildren([organizationInvoiceEditRoute]),
    ]),
    organizationVisitRedirectRoute,
    organizationTasksRoute.addChildren([
      organizationTaskCreateRoute,
      organizationTaskRoute,
    ]),
    organizationOfferingsRoute.addChildren([
      organizationOfferingCreateRoute,
      organizationOfferingEditRoute,
    ]),
    organizationOffersRoute.addChildren([
      organizationOfferCreateRoute,
      organizationOfferEditRoute,
    ]),
    organizationUsersRoute.addChildren([
      organizationUserCreateRoute,
      organizationUserEditRoute,
    ]),
    organizationUsersRolesRoute,
    organizationBranchesRoute.addChildren([
      organizationBranchCreateRoute,
      organizationBranchEditRoute,
    ]),
    organizationUsersBranchesRedirectRoute,
    organizationNotFoundRoute,
  ]),
  retiredDashboardRoute,
  notFoundRoute,
]);

/**
 * When the router shows its pending component, and for how long — two policies,
 * because "is anything on screen yet?" has two answers.
 *
 * **BOOT** — until the first navigation resolves. Nothing is on screen to keep:
 * the HTML splash is up, and the pending component (`FullPageSpinner`) renders
 * nothing of its own but HOLDS that splash. So it mounts at once (`pendingMs: 0`)
 * on EVERY cold URL — `/`, a bookmarked room, an emailed invite link — which
 * is what makes the boot one continuous screen instead of a splash that fades to
 * a blank page while a guard awaits the network (X-6). It used to be opted into
 * by four routes; a cold visit can land on any of them.
 *
 * It is also not held for a minimum time. The router's built-in
 * `defaultPendingMinMs` is **500ms**, counted from the moment the fallback
 * renders. It exists so a spinner cannot flash — but on boot the "spinner" is the
 * splash the user is already looking at, so there is nothing to flash, and the
 * rule simply parked every cold load for half a second: a guest's `/auth/refresh`
 * was answered at ~130ms and the login screen's own chunks were not even
 * requested until ~650ms.
 *
 * **IN-APP** — from then on. There IS a current screen, so keep it for up to 3s
 * while guards run (the `RouteProgressBar` reports the work); if the full-page
 * spinner does have to appear, the 500ms minimum is right — it now would flash.
 * This also covers the hop after sign-in: `/login` → `/` used to swap the form
 * for a spinner immediately and then hold it for the same half second.
 */
export const BOOT_PENDING_POLICY = {
  defaultPendingMs: 0,
  defaultPendingMinMs: 0,
} as const;

/** After the first navigation resolves: keep the current screen; a spinner may not flash. */
export const IN_APP_PENDING_POLICY = {
  defaultPendingMs: 3000,
  defaultPendingMinMs: 500,
} as const;

/** Build the app router under the boot policy; it settles itself after first load. */
export function createAppRouter() {
  const appRouter = createRouter({
    routeTree,
    // Preload the destination island's chunk (and pure loaders) on hover/touch.
    defaultPreload: 'intent',
    // Preloaded guard results are immediately stale: beforeLoad re-runs on the
    // real navigation, so the side-effectful guard chain (org context sync,
    // permission refetch) is never satisfied by a hover.
    defaultPreloadStaleTime: 0,
    ...BOOT_PENDING_POLICY,
    defaultPendingComponent: () => <FullPageSpinner />,
  });

  // `onResolved` fires only for the navigation that actually commits — a `/` →
  // `/login` redirect is one boot, not two — so the policy flips exactly when
  // the first real screen is up.
  const unsubscribe = appRouter.subscribe('onResolved', () => {
    unsubscribe();
    appRouter.update({ ...appRouter.options, ...IN_APP_PENDING_POLICY });
  });

  return appRouter;
}

/** The app's one router — boots under {@link BOOT_PENDING_POLICY}, then settles itself. */
export const router = createAppRouter();

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
  interface StaticDataRouteOption {
    /**
     * The island's manifest, on manifest-backed routes — how shared code (the
     * app nav, ⌘K) reads route metadata without importing pages.
     */
    manifest?: PageManifest;
    /**
     * A URL-driven dialog route (D24): it renders nothing of its own — the
     * page under it opens the drawer — so `PageTransition` holds that page
     * still while the dialog opens, switches and closes.
     */
    dialog?: true;
    /**
     * A layout whose children are one room (the patient file): a move between them is no page
     * change — `PageTransition` keeps what stays on screen still and rises only the part that
     * changed (`feat-payment-celebration` D13).
     */
    room?: true;
  }
}
