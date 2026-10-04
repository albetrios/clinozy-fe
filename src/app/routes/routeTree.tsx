import {
  createRootRoute,
  createRoute,
  createRouter,
  HeadContent,
  lazyRouteComponent,
  notFound,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { Suspense } from 'react';

import {
  requireOrgStatus,
  requirePersonalDashboardWorkspace,
  requirePersonalDeployment,
  requireProvisionedWorkspace,
  requireSuspendedOrgStatus,
  requireTeamDeployment,
  resolveActiveOrg,
} from '@/app/guards/org-gates.ts';
import { requireOnboardingWorkspace } from '@/app/guards/route-guards.ts';
import { redirectIfAuthenticated, requireAuth } from '@/core/rbac/guards.ts';
import { toGateContext } from '@/core/security/gate-context.ts';
import { gatewayFromManifest } from '@/core/security/gateway.ts';
import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import i18n from '@/lib/i18n/i18n.ts';
import { ensureNamespace } from '@/lib/i18n/load-namespace.ts';
import { I18N_NAMESPACES, type I18nNamespace } from '@/lib/i18n/namespaces.ts';
import {
  organizationAppointment,
  organizationDashboard,
  organizationLead,
} from '@/lib/routes/builders.ts';
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
import { manifest as appointmentManifest } from '@/pages/organization/$organizationSlug/appointments/$appointmentId/appointment-id.manifest.ts';
import { manifest as appointmentsManifest } from '@/pages/organization/$organizationSlug/appointments/appointments.manifest.ts';
import {
  validateAppointmentCreateSearch,
  validateAppointmentSearch,
  validateAppointmentsSearch,
} from '@/pages/organization/$organizationSlug/appointments/appointments.search.ts';
import { manifest as appointmentCreateManifest } from '@/pages/organization/$organizationSlug/appointments/create/create.manifest.ts';
import { manifest as dashboardManifest } from '@/pages/organization/$organizationSlug/dashboard/dashboard.manifest.ts';
import { manifest as leadManifest } from '@/pages/organization/$organizationSlug/leads/$leadId/lead-id.manifest.ts';
import { manifest as leadCreateManifest } from '@/pages/organization/$organizationSlug/leads/create/create.manifest.ts';
import { manifest as leadsManifest } from '@/pages/organization/$organizationSlug/leads/leads.manifest.ts';
import {
  validateLeadCreateSearch,
  validateLeadsSearch,
} from '@/pages/organization/$organizationSlug/leads/leads.search.ts';
import { manifest as manufacturerEditManifest } from '@/pages/organization/$organizationSlug/medical/manufacturers/$manufacturerId/edit/edit.manifest.ts';
import { manifest as manufacturerCreateManifest } from '@/pages/organization/$organizationSlug/medical/manufacturers/create/create.manifest.ts';
import { manifest as medicalManufacturersManifest } from '@/pages/organization/$organizationSlug/medical/manufacturers/manufacturers.manifest.ts';
import { manifest as medicalManifest } from '@/pages/organization/$organizationSlug/medical/medical.manifest.ts';
import {
  validateMedicalCreateSearch,
  validateMedicalSearch,
} from '@/pages/organization/$organizationSlug/medical/medical.search.ts';
import { manifest as medicineEditManifest } from '@/pages/organization/$organizationSlug/medical/medicines/$medicineId/edit/edit.manifest.ts';
import { manifest as medicineCreateManifest } from '@/pages/organization/$organizationSlug/medical/medicines/create/create.manifest.ts';
import { manifest as medicalMedicinesManifest } from '@/pages/organization/$organizationSlug/medical/medicines/medicines.manifest.ts';
import { manifest as mrEditManifest } from '@/pages/organization/$organizationSlug/medical/mrs/$mrId/edit/edit.manifest.ts';
import { manifest as mrVisitCreateManifest } from '@/pages/organization/$organizationSlug/medical/mrs/$mrId/visits/create/create.manifest.ts';
import { manifest as mrCreateManifest } from '@/pages/organization/$organizationSlug/medical/mrs/create/create.manifest.ts';
import { manifest as medicalMrsManifest } from '@/pages/organization/$organizationSlug/medical/mrs/mrs.manifest.ts';
import { manifest as medicalPaymentsManifest } from '@/pages/organization/$organizationSlug/medical/payments/payments.manifest.ts';
import { manifest as purchaseOrderEditManifest } from '@/pages/organization/$organizationSlug/medical/purchases/$purchaseOrderId/edit/edit.manifest.ts';
import { manifest as purchaseOrderManifest } from '@/pages/organization/$organizationSlug/medical/purchases/$purchaseOrderId/purchase-order-id.manifest.ts';
import { manifest as purchaseOrderReceiveManifest } from '@/pages/organization/$organizationSlug/medical/purchases/$purchaseOrderId/receive/receive.manifest.ts';
import { manifest as purchaseOrderCreateManifest } from '@/pages/organization/$organizationSlug/medical/purchases/create/create.manifest.ts';
import { manifest as medicalPurchasesManifest } from '@/pages/organization/$organizationSlug/medical/purchases/purchases.manifest.ts';
import { manifest as saleReturnManifest } from '@/pages/organization/$organizationSlug/medical/sales/$saleId/return/return.manifest.ts';
import { manifest as saleManifest } from '@/pages/organization/$organizationSlug/medical/sales/$saleId/sale-id.manifest.ts';
import { manifest as saleCreateManifest } from '@/pages/organization/$organizationSlug/medical/sales/create/create.manifest.ts';
import { manifest as medicalSalesManifest } from '@/pages/organization/$organizationSlug/medical/sales/sales.manifest.ts';
import { manifest as supplierEditManifest } from '@/pages/organization/$organizationSlug/medical/suppliers/$supplierId/edit/edit.manifest.ts';
import { manifest as supplierCreateManifest } from '@/pages/organization/$organizationSlug/medical/suppliers/create/create.manifest.ts';
import { manifest as medicalSuppliersManifest } from '@/pages/organization/$organizationSlug/medical/suppliers/suppliers.manifest.ts';
import { manifest as offeringEditManifest } from '@/pages/organization/$organizationSlug/offerings/$offeringId/edit/edit.manifest.ts';
import { manifest as offeringCreateManifest } from '@/pages/organization/$organizationSlug/offerings/create/create.manifest.ts';
import { manifest as offeringsManifest } from '@/pages/organization/$organizationSlug/offerings/offerings.manifest.ts';
import {
  validateOfferingCreateSearch,
  validateOfferingsSearch,
} from '@/pages/organization/$organizationSlug/offerings/offerings.search.ts';
import { manifest as offerEditManifest } from '@/pages/organization/$organizationSlug/offerings/offers/$offerId/edit/edit.manifest.ts';
import { manifest as offerCreateManifest } from '@/pages/organization/$organizationSlug/offerings/offers/create/create.manifest.ts';
import { manifest as offersManifest } from '@/pages/organization/$organizationSlug/offerings/offers/offers.manifest.ts';
import { validateOffersSearch } from '@/pages/organization/$organizationSlug/offerings/offers/offers.search.ts';
import { manifest as organizationShellManifest } from '@/pages/organization/$organizationSlug/organization-slug.manifest.ts';
import { validatePatientImagesSearch } from '@/pages/organization/$organizationSlug/patients/$patientId/images/images.search.ts';
import { manifest as patientFileManifest } from '@/pages/organization/$organizationSlug/patients/$patientId/patient-id.manifest.ts';
import {
  type PatientFileSearch,
  validatePatientFileDialogSearch,
  validatePatientFileSearch,
} from '@/pages/organization/$organizationSlug/patients/$patientId/patient-id.search.ts';
import { manifest as patientCreateManifest } from '@/pages/organization/$organizationSlug/patients/create/create.manifest.ts';
import { manifest as patientsManifest } from '@/pages/organization/$organizationSlug/patients/patients.manifest.ts';
import {
  validatePatientCreateSearch,
  validatePatientsSearch,
} from '@/pages/organization/$organizationSlug/patients/patients.search.ts';
import { manifest as paymentEditManifest } from '@/pages/organization/$organizationSlug/payments/$paymentId/edit/edit.manifest.ts';
import { manifest as dayCloseManifest } from '@/pages/organization/$organizationSlug/payments/day-close/day-close.manifest.ts';
import { manifest as payManifest } from '@/pages/organization/$organizationSlug/payments/pay/pay.manifest.ts';
import { manifest as paymentsManifest } from '@/pages/organization/$organizationSlug/payments/payments.manifest.ts';
import {
  validateDayCloseSearch,
  validatePaymentPaySearch,
  validatePaymentReceiveSearch,
  validatePaymentsSearch,
} from '@/pages/organization/$organizationSlug/payments/payments.search.ts';
import { manifest as creditEditManifest } from '@/pages/organization/$organizationSlug/payments/pending/$creditId/edit/edit.manifest.ts';
import { manifest as pendingCreateManifest } from '@/pages/organization/$organizationSlug/payments/pending/create/create.manifest.ts';
import { manifest as pendingManifest } from '@/pages/organization/$organizationSlug/payments/pending/pending.manifest.ts';
import { validatePendingSearch } from '@/pages/organization/$organizationSlug/payments/pending/pending.search.ts';
import { manifest as receiveManifest } from '@/pages/organization/$organizationSlug/payments/receive/receive.manifest.ts';
import { manifest as stockItemsManifest } from '@/pages/organization/$organizationSlug/stock/items/items.manifest.ts';
import { manifest as stockManifest } from '@/pages/organization/$organizationSlug/stock/stock.manifest.ts';
import { manifest as suspendedManifest } from '@/pages/organization/$organizationSlug/suspended/suspended.manifest.ts';
import { manifest as taskManifest } from '@/pages/organization/$organizationSlug/tasks/$taskId/task-id.manifest.ts';
import { manifest as taskCreateManifest } from '@/pages/organization/$organizationSlug/tasks/create/create.manifest.ts';
import { manifest as tasksManifest } from '@/pages/organization/$organizationSlug/tasks/tasks.manifest.ts';
import {
  validateTaskCreateSearch,
  validateTasksSearch,
} from '@/pages/organization/$organizationSlug/tasks/tasks.search.ts';
import { manifest as todayManifest } from '@/pages/organization/$organizationSlug/today/today.manifest.ts';
import { validateTodaySearch } from '@/pages/organization/$organizationSlug/today/today.search.ts';
import { manifest as userEditManifest } from '@/pages/organization/$organizationSlug/users/$userId/edit/edit.manifest.ts';
import { manifest as branchEditManifest } from '@/pages/organization/$organizationSlug/users/branches/$branchId/edit/edit.manifest.ts';
import { manifest as usersBranchesManifest } from '@/pages/organization/$organizationSlug/users/branches/branches.manifest.ts';
import { validateBranchesSearch } from '@/pages/organization/$organizationSlug/users/branches/branches.search.ts';
import { manifest as branchCreateManifest } from '@/pages/organization/$organizationSlug/users/branches/create/create.manifest.ts';
import { manifest as userCreateManifest } from '@/pages/organization/$organizationSlug/users/create/create.manifest.ts';
import { manifest as usersRolesManifest } from '@/pages/organization/$organizationSlug/users/roles/roles.manifest.ts';
import { manifest as usersManifest } from '@/pages/organization/$organizationSlug/users/users.manifest.ts';
import {
  validateRolesSearch,
  validateUserEditSearch,
  validateUsersSearch,
} from '@/pages/organization/$organizationSlug/users/users.search.ts';
import { manifest as organizationPickerManifest } from '@/pages/organization/organization.manifest.ts';
import type { PatientFileSectionSlug } from '@/shared/clinic/patient-file-sections.ts';
import { AppearanceDialogLazy } from '@/shared/components/AppearanceDialog/index.ts';
import { AppSplashSlotLazy } from '@/shared/components/AppSplashSlot/index.ts';
import { ConsentBannerLazy } from '@/shared/components/ConsentBanner/index.ts';
import { FloatingEdgeControls } from '@/shared/components/FloatingEdgeControls/index.ts';
import { FullPageSpinner } from '@/shared/components/FullPageSpinner/index.ts';
import { OfflineIndicator } from '@/shared/components/OfflineIndicator/index.ts';
import { RouteAnnouncer } from '@/shared/components/RouteAnnouncer/index.ts';
import { RouteErrorBoundary } from '@/shared/components/RouteErrorBoundary/index.ts';
import { RouteProgressBar } from '@/shared/components/RouteProgressBar/index.ts';
import { SettingsModalLazy } from '@/shared/components/SettingsModal/index.ts';
import { SectionErrorBoundary } from '@/shared/components/WidgetErrorBoundary/index.ts';
import { AppToaster } from '@/shared/notify/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';
import { useThemeStore } from '@/shared/store/useThemeStore/index.ts';
import { resolveRootRedirect } from '@/shared/tenancy/organization-resolver.ts';

import { ErrorBoundary } from './ErrorBoundary.tsx';

// ── Lazy components ──
// lazyRouteComponent (not React.lazy): the router can call `.preload()` on
// these, which is what makes `defaultPreload: 'intent'` actually fetch the
// island's chunk on hover/touch. Suspension is handled by the router's
// defaultPendingComponent.
function localizedRoute<T>(namespaces: readonly I18nNamespace[], load: () => Promise<T>) {
  return async () => {
    const locale = useLocaleStore.getState().locale;
    const [, module] = await Promise.all([
      Promise.all(namespaces.map((ns) => ensureNamespace(locale, ns))),
      load(),
    ]);
    return module;
  };
}

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
// `clinic` vocabulary loads with the shell rather than with each room.
const OrganizationShell = lazyRouteComponent(
  localizedRoute(
    [I18N_NAMESPACES.clinic],
    () => import('@/pages/organization/$organizationSlug/organization-slug.route.tsx'),
  ),
  'Component',
);
const DashboardPage = lazyRouteComponent(
  localizedRoute(
    [I18N_NAMESPACES.dashboard],
    () => import('@/pages/organization/$organizationSlug/dashboard/dashboard.route.tsx'),
  ),
  'Component',
);
// Personal-org space reuses the shared AppLayout directly (no org param in URL).
const PersonalShell = lazyRouteComponent(
  () => import('@/shared/layouts/AppLayout/index.ts'),
  'Component',
);
const SuspendedPage = lazyRouteComponent(
  () => import('@/pages/organization/$organizationSlug/suspended/suspended.route.tsx'),
  'Component',
);
// Clinic rooms (KICKOFF §4): each loads its own namespace with its chunk.
// Today's work queue reads the Tasks rule copy (one task model, Q-T3): `tasks` loads with it.
const TodayPage = lazyRouteComponent(
  localizedRoute(
    [I18N_NAMESPACES.today, I18N_NAMESPACES.tasks],
    () => import('@/pages/organization/$organizationSlug/today/today.route.tsx'),
  ),
  'Component',
);
const LeadsPage = lazyRouteComponent(
  localizedRoute(
    [I18N_NAMESPACES.leads],
    () => import('@/pages/organization/$organizationSlug/leads/leads.route.tsx'),
  ),
  'Component',
);
// The Leads room's dialog routes render nothing of their own (the list opens
// the drawer), so they need no namespace beyond the room's.
const LeadCreateRoute = lazyRouteComponent(
  () => import('@/pages/organization/$organizationSlug/leads/create/create.route.tsx'),
  'Component',
);
const LeadRoute = lazyRouteComponent(
  () => import('@/pages/organization/$organizationSlug/leads/$leadId/lead-id.route.tsx'),
  'Component',
);
const AppointmentsPage = lazyRouteComponent(
  localizedRoute(
    [I18N_NAMESPACES.appointments],
    () =>
      import('@/pages/organization/$organizationSlug/appointments/appointments.route.tsx'),
  ),
  'Component',
);
// The Appointments room's dialog routes render nothing of their own (the page
// opens the drawer), so they need no namespace beyond the room's.
const AppointmentCreateRoute = lazyRouteComponent(
  () =>
    import('@/pages/organization/$organizationSlug/appointments/create/create.route.tsx'),
  'Component',
);
const AppointmentRoute = lazyRouteComponent(
  () =>
    import('@/pages/organization/$organizationSlug/appointments/$appointmentId/appointment-id.route.tsx'),
  'Component',
);
const PatientsPage = lazyRouteComponent(
  localizedRoute(
    [I18N_NAMESPACES.patients],
    () => import('@/pages/organization/$organizationSlug/patients/patients.route.tsx'),
  ),
  'Component',
);
// The Patients room's dialog route renders nothing of its own (the list opens
// the drawer), so it needs no namespace beyond the room's.
const PatientCreateRoute = lazyRouteComponent(
  () => import('@/pages/organization/$organizationSlug/patients/create/create.route.tsx'),
  'Component',
);
// The patient file (KICKOFF §6.6, L-42): its layout and every section and
// dialog route come through ONE lazy module, so this entry chunk carries one
// import for all of them. Each route's own chunk is preloaded right after the
// module, so a navigation never suspends on the second hop.
const loadPatientFile = localizedRoute(
  [I18N_NAMESPACES.patientFile],
  () =>
    import('@/pages/organization/$organizationSlug/patients/$patientId/patient-id.sections.ts'),
);
type PatientFileRoutes = Omit<
  Awaited<ReturnType<typeof loadPatientFile>>,
  'PATIENT_FILE_SECTION_PAGES'
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
const PaymentsPage = lazyRouteComponent(
  localizedRoute(
    [I18N_NAMESPACES.payments],
    () => import('@/pages/organization/$organizationSlug/payments/payments.route.tsx'),
  ),
  'Component',
);
const PaymentsPendingPage = lazyRouteComponent(
  localizedRoute(
    [I18N_NAMESPACES.payments],
    () =>
      import('@/pages/organization/$organizationSlug/payments/pending/pending.route.tsx'),
  ),
  'Component',
);
// The Payments room's dialog routes render nothing of their own (the ledger or
// Pending opens the drawer), so they need no namespace beyond the room's.
const PaymentReceiveRoute = lazyRouteComponent(
  () =>
    import('@/pages/organization/$organizationSlug/payments/receive/receive.route.tsx'),
  'Component',
);
const PaymentPayRoute = lazyRouteComponent(
  () => import('@/pages/organization/$organizationSlug/payments/pay/pay.route.tsx'),
  'Component',
);
const PaymentEditRoute = lazyRouteComponent(
  () =>
    import('@/pages/organization/$organizationSlug/payments/$paymentId/edit/edit.route.tsx'),
  'Component',
);
const DayCloseRoute = lazyRouteComponent(
  () =>
    import('@/pages/organization/$organizationSlug/payments/day-close/day-close.route.tsx'),
  'Component',
);
const PendingCreateRoute = lazyRouteComponent(
  () =>
    import('@/pages/organization/$organizationSlug/payments/pending/create/create.route.tsx'),
  'Component',
);
const CreditEditRoute = lazyRouteComponent(
  () =>
    import('@/pages/organization/$organizationSlug/payments/pending/$creditId/edit/edit.route.tsx'),
  'Component',
);
const TasksPage = lazyRouteComponent(
  localizedRoute(
    [I18N_NAMESPACES.tasks],
    () => import('@/pages/organization/$organizationSlug/tasks/tasks.route.tsx'),
  ),
  'Component',
);
// The Tasks room's dialog routes render nothing of their own (the list opens the
// drawers), so they need no namespace beyond the room's.
const TaskCreateRoute = lazyRouteComponent(
  () => import('@/pages/organization/$organizationSlug/tasks/create/create.route.tsx'),
  'Component',
);
const TaskRoute = lazyRouteComponent(
  () => import('@/pages/organization/$organizationSlug/tasks/$taskId/task-id.route.tsx'),
  'Component',
);
const OfferingsPage = lazyRouteComponent(
  localizedRoute(
    [I18N_NAMESPACES.offerings],
    () => import('@/pages/organization/$organizationSlug/offerings/offerings.route.tsx'),
  ),
  'Component',
);
// The Offering drawer's dialog routes render nothing of their own (the list
// opens the drawer), so they need no namespace beyond the room's.
const OfferingCreateRoute = lazyRouteComponent(
  () =>
    import('@/pages/organization/$organizationSlug/offerings/create/create.route.tsx'),
  'Component',
);
const OfferingEditRoute = lazyRouteComponent(
  () =>
    import('@/pages/organization/$organizationSlug/offerings/$offeringId/edit/edit.route.tsx'),
  'Component',
);
// The Offers tab is the room's second page (D24): its own chunk, the room's namespace.
const OffersPage = lazyRouteComponent(
  localizedRoute(
    [I18N_NAMESPACES.offerings],
    () =>
      import('@/pages/organization/$organizationSlug/offerings/offers/offers.route.tsx'),
  ),
  'Component',
);
// The Offer drawer's dialog routes render nothing of their own either.
const OfferCreateRoute = lazyRouteComponent(
  () =>
    import('@/pages/organization/$organizationSlug/offerings/offers/create/create.route.tsx'),
  'Component',
);
const OfferEditRoute = lazyRouteComponent(
  () =>
    import('@/pages/organization/$organizationSlug/offerings/offers/$offerId/edit/edit.route.tsx'),
  'Component',
);
const UsersPage = lazyRouteComponent(
  localizedRoute(
    [I18N_NAMESPACES.users],
    () => import('@/pages/organization/$organizationSlug/users/users.route.tsx'),
  ),
  'Component',
);
// The Users room's dialog routes render nothing of their own (the Team opens
// the drawer), so they need no namespace beyond the room's.
const UserCreateRoute = lazyRouteComponent(
  () => import('@/pages/organization/$organizationSlug/users/create/create.route.tsx'),
  'Component',
);
const UserEditRoute = lazyRouteComponent(
  () =>
    import('@/pages/organization/$organizationSlug/users/$userId/edit/edit.route.tsx'),
  'Component',
);
const UsersRolesPage = lazyRouteComponent(
  localizedRoute(
    [I18N_NAMESPACES.users],
    () => import('@/pages/organization/$organizationSlug/users/roles/roles.route.tsx'),
  ),
  'Component',
);
const UsersBranchesPage = lazyRouteComponent(
  localizedRoute(
    [I18N_NAMESPACES.users],
    () =>
      import('@/pages/organization/$organizationSlug/users/branches/branches.route.tsx'),
  ),
  'Component',
);
// Branches' dialog routes render nothing of their own (the list opens the drawer).
const BranchCreateRoute = lazyRouteComponent(
  () =>
    import('@/pages/organization/$organizationSlug/users/branches/create/create.route.tsx'),
  'Component',
);
const BranchEditRoute = lazyRouteComponent(
  () =>
    import('@/pages/organization/$organizationSlug/users/branches/$branchId/edit/edit.route.tsx'),
  'Component',
);
const MedicalLayout = lazyRouteComponent(
  localizedRoute(
    [I18N_NAMESPACES.medical],
    () => import('@/pages/organization/$organizationSlug/medical/medical.route.tsx'),
  ),
  'Component',
);
const MedicalSalesPage = lazyRouteComponent(
  localizedRoute(
    [I18N_NAMESPACES.medical],
    () => import('@/pages/organization/$organizationSlug/medical/sales/sales.route.tsx'),
  ),
  'Component',
);
const MedicalMedicinesPage = lazyRouteComponent(
  localizedRoute(
    [I18N_NAMESPACES.medical],
    () =>
      import('@/pages/organization/$organizationSlug/medical/medicines/medicines.route.tsx'),
  ),
  'Component',
);
const MedicalPurchasesPage = lazyRouteComponent(
  localizedRoute(
    [I18N_NAMESPACES.medical],
    () =>
      import('@/pages/organization/$organizationSlug/medical/purchases/purchases.route.tsx'),
  ),
  'Component',
);
const MedicalSuppliersPage = lazyRouteComponent(
  localizedRoute(
    [I18N_NAMESPACES.medical],
    () =>
      import('@/pages/organization/$organizationSlug/medical/suppliers/suppliers.route.tsx'),
  ),
  'Component',
);
const MedicalManufacturersPage = lazyRouteComponent(
  localizedRoute(
    [I18N_NAMESPACES.medical],
    () =>
      import('@/pages/organization/$organizationSlug/medical/manufacturers/manufacturers.route.tsx'),
  ),
  'Component',
);
const MedicalMrsPage = lazyRouteComponent(
  localizedRoute(
    [I18N_NAMESPACES.medical],
    () => import('@/pages/organization/$organizationSlug/medical/mrs/mrs.route.tsx'),
  ),
  'Component',
);
const MedicalPaymentsPage = lazyRouteComponent(
  localizedRoute(
    [I18N_NAMESPACES.medical],
    () =>
      import('@/pages/organization/$organizationSlug/medical/payments/payments.route.tsx'),
  ),
  'Component',
);
// The Medical dialog routes render nothing of their own (each tab page opens
// the drawer), so they need no namespace beyond the room's.
const SaleCreateRoute = lazyRouteComponent(
  () =>
    import('@/pages/organization/$organizationSlug/medical/sales/create/create.route.tsx'),
  'Component',
);
const SaleRoute = lazyRouteComponent(
  () =>
    import('@/pages/organization/$organizationSlug/medical/sales/$saleId/sale-id.route.tsx'),
  'Component',
);
const SaleReturnRoute = lazyRouteComponent(
  () =>
    import('@/pages/organization/$organizationSlug/medical/sales/$saleId/return/return.route.tsx'),
  'Component',
);
const MedicineCreateRoute = lazyRouteComponent(
  () =>
    import('@/pages/organization/$organizationSlug/medical/medicines/create/create.route.tsx'),
  'Component',
);
const MedicineEditRoute = lazyRouteComponent(
  () =>
    import('@/pages/organization/$organizationSlug/medical/medicines/$medicineId/edit/edit.route.tsx'),
  'Component',
);
const PurchaseOrderCreateRoute = lazyRouteComponent(
  () =>
    import('@/pages/organization/$organizationSlug/medical/purchases/create/create.route.tsx'),
  'Component',
);
const PurchaseOrderRoute = lazyRouteComponent(
  () =>
    import('@/pages/organization/$organizationSlug/medical/purchases/$purchaseOrderId/purchase-order-id.route.tsx'),
  'Component',
);
const PurchaseOrderEditRoute = lazyRouteComponent(
  () =>
    import('@/pages/organization/$organizationSlug/medical/purchases/$purchaseOrderId/edit/edit.route.tsx'),
  'Component',
);
const PurchaseOrderReceiveRoute = lazyRouteComponent(
  () =>
    import('@/pages/organization/$organizationSlug/medical/purchases/$purchaseOrderId/receive/receive.route.tsx'),
  'Component',
);
const SupplierCreateRoute = lazyRouteComponent(
  () =>
    import('@/pages/organization/$organizationSlug/medical/suppliers/create/create.route.tsx'),
  'Component',
);
const SupplierEditRoute = lazyRouteComponent(
  () =>
    import('@/pages/organization/$organizationSlug/medical/suppliers/$supplierId/edit/edit.route.tsx'),
  'Component',
);
const ManufacturerCreateRoute = lazyRouteComponent(
  () =>
    import('@/pages/organization/$organizationSlug/medical/manufacturers/create/create.route.tsx'),
  'Component',
);
const ManufacturerEditRoute = lazyRouteComponent(
  () =>
    import('@/pages/organization/$organizationSlug/medical/manufacturers/$manufacturerId/edit/edit.route.tsx'),
  'Component',
);
const MrCreateRoute = lazyRouteComponent(
  () =>
    import('@/pages/organization/$organizationSlug/medical/mrs/create/create.route.tsx'),
  'Component',
);
const MrEditRoute = lazyRouteComponent(
  () =>
    import('@/pages/organization/$organizationSlug/medical/mrs/$mrId/edit/edit.route.tsx'),
  'Component',
);
const MrVisitCreateRoute = lazyRouteComponent(
  () =>
    import('@/pages/organization/$organizationSlug/medical/mrs/$mrId/visits/create/create.route.tsx'),
  'Component',
);
const StockLayout = lazyRouteComponent(
  localizedRoute(
    [I18N_NAMESPACES.clinicStock],
    () => import('@/pages/organization/$organizationSlug/stock/stock.route.tsx'),
  ),
  'Component',
);
const StockItemsPage = lazyRouteComponent(
  localizedRoute(
    [I18N_NAMESPACES.clinicStock],
    () => import('@/pages/organization/$organizationSlug/stock/items/items.route.tsx'),
  ),
  'Component',
);
const NotFoundPage = lazyRouteComponent(
  () => import('@/app/routes/NotFoundPage.tsx'),
  'Component',
);
const PublicLayout = lazyRouteComponent(
  () => import('@/shared/layouts/PublicLayout/index.ts'),
  'PublicLayout',
);

/**
 * The variant loaders are imported DYNAMICALLY, never statically: this file is
 * the entry chunk, and the initial-JS budget has well under a kilobyte to spare.
 * A static import of either module costs more than that on every load, to save
 * one request on the loads that reach a shell. The import is a few hundred bytes
 * and runs alongside the route's own chunks, so nothing waits on it.
 */
function preloadAuthLayoutVariant(): Promise<unknown> {
  return import('@/shared/layouts/AuthLayout/auth-layout-variants.ts').then((m) =>
    m.preloadAuthLayoutVariant(useThemeStore.getState().authVariant),
  );
}

function preloadSessionAppShell(): Promise<unknown> {
  return import('@/shared/layouts/AppLayout/app-layout-variants.ts').then((m) =>
    m.preloadSessionAppShell(),
  );
}

/** The auth layout AND the variant it is about to lazy-load, side by side. */
function preloadAuthShell(): Promise<unknown> {
  return Promise.all([AuthLayout.preload?.(), preloadAuthLayoutVariant()]);
}

/**
 * Warm the chunks a cold load is about to need, WHILE the auth bootstrap is in
 * flight — called once from `main.tsx`.
 *
 * Every entry route awaits `/auth/refresh` in `beforeLoad` before the router
 * loads a single component, so the destination's chunks were requested only
 * after the network had answered: guard, THEN chunks, THEN (for the layouts) a
 * variant chunk. None of that depends on the answer. `likelySignedIn` is a hint,
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
   * Onboarding first, then everything else.
   *
   * A FIRST sign-in — the case this warm-up exists for, since a returning user
   * already had the shells warmed at boot — lands on onboarding, not the
   * dashboard. It is also the smallest of the four. Starting all four at once
   * lets the much heavier dashboard shell compete with it for the same
   * connections, so the one chunk most likely to be needed can arrive last.
   *
   * `allSettled`, not `all`: one destination failing to warm says nothing about
   * the others, and there is no failure worth catching — the router re-requests
   * every chunk through the normal path, where an error boundary and a Retry
   * exist. It also means this never rejects, so callers need no catch.
   */
  await Promise.allSettled([OnboardingPage.preload?.()]);
  await Promise.allSettled([
    PersonalShell.preload?.(),
    OrganizationShell.preload?.(),
    DashboardPage.preload?.(),
  ]);
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
      {/* Right-edge handles: appearance (when unlocked) + language. Contains
          itself — see FloatingEdgeControls. */}
      <FloatingEdgeControls />
      {/* Dedicated Appearance dialog — its own surface, opened via useUIStore.
          A fixed-position overlay mounted at the ROOT: without its own boundary
          a throw in here reached the global fallback and replaced the entire
          app. Silent, because an overlay has nowhere in the layout to put an
          error card — the dialog just is not there, and the throw is reported. */}
      <SectionErrorBoundary
        title={i18n.t(ERRORS_KEYS.widget.appearance, { ns: ERRORS_NS })}
        variant="silent"
      >
        <AppearanceDialogLazy />
      </SectionErrorBoundary>
      {/* Dedicated Language & region dialog — mirrors Appearance, opened via useUIStore. */}
      <OfflineIndicator />
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
  notFoundComponent: () => <NotFoundPage />,
  errorComponent: ({ error }) => <ErrorBoundary error={error} />,
});

// ── Auth shell ──
// Pathless layout route (`id`, not `path`): mounts the split-screen AuthLayout
// once over every auth page; the pages keep their top-level URLs (/login, …).
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
  // Nested layouts are invisible to the router's component preloader — and so
  // is the variant the layout then lazy-loads, which used to cost one more round
  // trip AFTER the layout had mounted (skeleton → variant → form).
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
// centered chrome without the auth split-screen or app sidebar.
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
// `/` keeps no UI: last-used organization → its dashboard, else the
// `/organization` picker, else onboarding (routing-and-tenancy.md §2).
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
  // The shell AppLayout will pick, fetched alongside the route's own chunks
  // rather than after the layout mounts (see preloadSessionAppShell).
  loader: () => preloadSessionAppShell(),
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

const organizationDashboardRoute = createRoute({
  getParentRoute: () => organizationShellRoute,
  path: 'dashboard',
  head: manifestHead(dashboardManifest),
  staticData: { manifest: dashboardManifest },
  beforeLoad: async ({ params, preload, location }) => {
    if (preload) return;
    await gatewayFromManifest(dashboardManifest)(toGateContext(location, params));
    requireOrgStatus({ params });
  },
  component: DashboardPage,
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
// The org index and an unknown in-org path go to the member's role home
// (D25, S:115); `/medical` and `/stock` open on their first tab.
const organizationIndexRoute = createRoute({
  getParentRoute: () => organizationShellRoute,
  path: '/',
  beforeLoad: async ({ params, preload }) => {
    if (preload) return;
    const { clinicHomeRoute } = await import('@/shared/clinic/clinic-home.ts');
    throw redirect(
      (await clinicHomeRoute(params.organizationSlug)) ??
        organizationDashboard(params.organizationSlug),
    );
  },
  component: () => null,
  errorComponent: RouteErrorBoundary,
});

const organizationNotFoundRoute = createRoute({
  getParentRoute: () => organizationShellRoute,
  path: '$',
  beforeLoad: async ({ params, preload }) => {
    if (preload) return;
    const [{ clinicHomeRoute }, { notify }] = await Promise.all([
      import('@/shared/clinic/clinic-home.ts'),
      import('@/shared/notify/index.ts'),
    ]);
    notify.info(i18n.t(ERRORS_KEYS.route.pageNotFound, { ns: ERRORS_NS }));
    throw redirect(
      (await clinicHomeRoute(params.organizationSlug)) ??
        organizationDashboard(params.organizationSlug),
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
  beforeLoad: async ({ params, preload, location }) => {
    if (preload) return;
    await gatewayFromManifest(todayManifest)(toGateContext(location, params));
    requireOrgStatus({ params });
  },
  component: TodayPage,
  errorComponent: RouteErrorBoundary,
});

const organizationLeadsRoute = createRoute({
  getParentRoute: () => organizationShellRoute,
  path: 'leads',
  head: manifestHead(leadsManifest),
  staticData: { manifest: leadsManifest },
  validateSearch: validateLeadsSearch,
  beforeLoad: async ({ params, preload, location }) => {
    if (preload) return;
    await gatewayFromManifest(leadsManifest)(toGateContext(location, params));
    requireOrgStatus({ params });
  },
  component: LeadsPage,
  errorComponent: RouteErrorBoundary,
});

// URL-driven dialogs over the Leads list (D24, S:23–24): each renders nothing;
// the list page reads the URL and opens the drawer over itself.
const organizationLeadCreateRoute = createRoute({
  getParentRoute: () => organizationLeadsRoute,
  path: 'create',
  head: manifestHead(leadCreateManifest),
  staticData: { manifest: leadCreateManifest },
  validateSearch: validateLeadCreateSearch,
  beforeLoad: async ({ params, preload, location }) => {
    if (preload) return;
    await gatewayFromManifest(leadCreateManifest)(toGateContext(location, params));
    requireOrgStatus({ params });
  },
  component: LeadCreateRoute,
  errorComponent: RouteErrorBoundary,
});

const organizationLeadRoute = createRoute({
  getParentRoute: () => organizationLeadsRoute,
  path: '$leadId',
  head: manifestHead(leadManifest),
  staticData: { manifest: leadManifest },
  beforeLoad: async ({ params, preload, location }) => {
    if (preload) return;
    await gatewayFromManifest(leadManifest)(toGateContext(location, params));
    requireOrgStatus({ params });
  },
  component: LeadRoute,
  errorComponent: RouteErrorBoundary,
});

// Show and edit are one drawer (S:25): the edit URL lands on the lead's,
// keeping the list's filters.
const organizationLeadEditRoute = createRoute({
  getParentRoute: () => organizationLeadsRoute,
  path: '$leadId/edit',
  beforeLoad: ({ params, search }) => {
    throw redirect({
      ...organizationLead(params.organizationSlug, params.leadId),
      search,
    });
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
  beforeLoad: async ({ params, preload, location }) => {
    if (preload) return;
    await gatewayFromManifest(appointmentsManifest)(toGateContext(location, params));
    requireOrgStatus({ params });
  },
  component: AppointmentsPage,
  errorComponent: RouteErrorBoundary,
});

// URL-driven dialogs over the Appointments page (D24, S:27–28): each renders
// nothing; the page reads the URL and opens the appointment form over itself.
const organizationAppointmentCreateRoute = createRoute({
  getParentRoute: () => organizationAppointmentsRoute,
  path: 'create',
  head: manifestHead(appointmentCreateManifest),
  staticData: { manifest: appointmentCreateManifest },
  validateSearch: validateAppointmentCreateSearch,
  beforeLoad: async ({ params, preload, location }) => {
    if (preload) return;
    await gatewayFromManifest(appointmentCreateManifest)(toGateContext(location, params));
    requireOrgStatus({ params });
  },
  component: AppointmentCreateRoute,
  errorComponent: RouteErrorBoundary,
});

const organizationAppointmentRoute = createRoute({
  getParentRoute: () => organizationAppointmentsRoute,
  path: '$appointmentId',
  head: manifestHead(appointmentManifest),
  staticData: { manifest: appointmentManifest },
  validateSearch: validateAppointmentSearch,
  beforeLoad: async ({ params, preload, location }) => {
    if (preload) return;
    await gatewayFromManifest(appointmentManifest)(toGateContext(location, params));
    requireOrgStatus({ params });
  },
  component: AppointmentRoute,
  errorComponent: RouteErrorBoundary,
});

// Show is edit (S:29): the edit URL lands on the booking's, keeping the page's
// filters and the drawer's params.
const organizationAppointmentEditRoute = createRoute({
  getParentRoute: () => organizationAppointmentsRoute,
  path: '$appointmentId/edit',
  beforeLoad: ({ params, search }) => {
    throw redirect({
      ...organizationAppointment(params.organizationSlug, params.appointmentId),
      search,
    });
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
  beforeLoad: async ({ params, preload, location }) => {
    if (preload) return;
    await gatewayFromManifest(patientsManifest)(toGateContext(location, params));
    requireOrgStatus({ params });
  },
  component: PatientsPage,
  errorComponent: RouteErrorBoundary,
});

// URL-driven dialog over the Patients list (D24, S:31): it renders nothing;
// the list page reads the URL and opens the New patient drawer over itself.
const organizationPatientCreateRoute = createRoute({
  getParentRoute: () => organizationPatientsRoute,
  path: 'create',
  head: manifestHead(patientCreateManifest),
  staticData: { manifest: patientCreateManifest },
  validateSearch: validatePatientCreateSearch,
  beforeLoad: async ({ params, preload, location }) => {
    if (preload) return;
    await gatewayFromManifest(patientCreateManifest)(toGateContext(location, params));
    requireOrgStatus({ params });
  },
  component: PatientCreateRoute,
  errorComponent: RouteErrorBoundary,
});

// The patient file (KICKOFF §4, §6.6): a layout of its own beside the list,
// gated like the room; its sections and dialog routes inherit the gate, and
// in-room access is `useClinicAccess` (D9).
const organizationPatientFileRoute = createRoute({
  getParentRoute: () => organizationShellRoute,
  path: 'patients/$patientId',
  head: manifestHead(patientFileManifest),
  staticData: { manifest: patientFileManifest },
  validateSearch: validatePatientFileSearch,
  beforeLoad: async ({ params, preload, location }) => {
    if (preload) return;
    await gatewayFromManifest(patientFileManifest)(toGateContext(location, params));
    requireOrgStatus({ params });
  },
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

// URL-driven dialog over the section it opened from (S:34, A-F1): the drawer
// route renders that section and the patient drawer over it.
const organizationPatientEditRoute = createRoute({
  getParentRoute: () => organizationPatientFileRoute,
  path: 'edit',
  validateSearch: validatePatientFileDialogSearch,
  component: patientFileComponent('PatientFileEdit'),
  errorComponent: RouteErrorBoundary,
});

// The photo viewer and Photo details, dialogs over Photos (S:41–42).
const organizationPatientPhotoRoute = createRoute({
  getParentRoute: () => organizationPatientImagesRoute,
  path: '$imageId',
  component: patientFileComponent('PatientPhotoViewer'),
  errorComponent: RouteErrorBoundary,
});

const organizationPatientPhotoEditRoute = createRoute({
  getParentRoute: () => organizationPatientImagesRoute,
  path: '$imageId/edit',
  component: patientFileComponent('PatientPhotoDetails'),
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
  beforeLoad: async ({ params, preload, location }) => {
    if (preload) return;
    await gatewayFromManifest(paymentsManifest)(toGateContext(location, params));
    requireOrgStatus({ params });
  },
  component: PaymentsPage,
  errorComponent: RouteErrorBoundary,
});

const organizationPaymentReceiveRoute = createRoute({
  getParentRoute: () => organizationPaymentsRoute,
  path: 'receive',
  head: manifestHead(receiveManifest),
  staticData: { manifest: receiveManifest },
  validateSearch: validatePaymentReceiveSearch,
  beforeLoad: async ({ params, preload, location }) => {
    if (preload) return;
    await gatewayFromManifest(receiveManifest)(toGateContext(location, params));
    requireOrgStatus({ params });
  },
  component: PaymentReceiveRoute,
  errorComponent: RouteErrorBoundary,
});

const organizationPaymentPayRoute = createRoute({
  getParentRoute: () => organizationPaymentsRoute,
  path: 'pay',
  head: manifestHead(payManifest),
  staticData: { manifest: payManifest },
  validateSearch: validatePaymentPaySearch,
  beforeLoad: async ({ params, preload, location }) => {
    if (preload) return;
    await gatewayFromManifest(payManifest)(toGateContext(location, params));
    requireOrgStatus({ params });
  },
  component: PaymentPayRoute,
  errorComponent: RouteErrorBoundary,
});

const organizationPaymentEditRoute = createRoute({
  getParentRoute: () => organizationPaymentsRoute,
  path: '$paymentId/edit',
  head: manifestHead(paymentEditManifest),
  staticData: { manifest: paymentEditManifest },
  beforeLoad: async ({ params, preload, location }) => {
    if (preload) return;
    await gatewayFromManifest(paymentEditManifest)(toGateContext(location, params));
    requireOrgStatus({ params });
  },
  component: PaymentEditRoute,
  errorComponent: RouteErrorBoundary,
});

const organizationDayCloseRoute = createRoute({
  getParentRoute: () => organizationPaymentsRoute,
  path: 'day-close',
  head: manifestHead(dayCloseManifest),
  staticData: { manifest: dayCloseManifest },
  validateSearch: validateDayCloseSearch,
  beforeLoad: async ({ params, preload, location }) => {
    if (preload) return;
    await gatewayFromManifest(dayCloseManifest)(toGateContext(location, params));
    requireOrgStatus({ params });
  },
  component: DayCloseRoute,
  errorComponent: RouteErrorBoundary,
});

// Payments › Pending (`S:88`): the room's second tab, a page of its own — a
// sibling of the ledger in the tree, a child folder on disk.
const organizationPaymentsPendingRoute = createRoute({
  getParentRoute: () => organizationShellRoute,
  path: 'payments/pending',
  head: manifestHead(pendingManifest),
  staticData: { manifest: pendingManifest },
  validateSearch: validatePendingSearch,
  beforeLoad: async ({ params, preload, location }) => {
    if (preload) return;
    await gatewayFromManifest(pendingManifest)(toGateContext(location, params));
    requireOrgStatus({ params });
  },
  component: PaymentsPendingPage,
  errorComponent: RouteErrorBoundary,
});

// Add pending's `?direction=give|take` (`S:89`) is Pending's own `direction`
// filter (`S:88`) — one key, read by both.
const organizationPendingCreateRoute = createRoute({
  getParentRoute: () => organizationPaymentsPendingRoute,
  path: 'create',
  head: manifestHead(pendingCreateManifest),
  staticData: { manifest: pendingCreateManifest },
  beforeLoad: async ({ params, preload, location }) => {
    if (preload) return;
    await gatewayFromManifest(pendingCreateManifest)(toGateContext(location, params));
    requireOrgStatus({ params });
  },
  component: PendingCreateRoute,
  errorComponent: RouteErrorBoundary,
});

const organizationCreditEditRoute = createRoute({
  getParentRoute: () => organizationPaymentsPendingRoute,
  path: '$creditId/edit',
  head: manifestHead(creditEditManifest),
  staticData: { manifest: creditEditManifest },
  beforeLoad: async ({ params, preload, location }) => {
    if (preload) return;
    await gatewayFromManifest(creditEditManifest)(toGateContext(location, params));
    requireOrgStatus({ params });
  },
  component: CreditEditRoute,
  errorComponent: RouteErrorBoundary,
});

const organizationTasksRoute = createRoute({
  getParentRoute: () => organizationShellRoute,
  path: 'tasks',
  head: manifestHead(tasksManifest),
  staticData: { manifest: tasksManifest },
  validateSearch: validateTasksSearch,
  beforeLoad: async ({ params, preload, location }) => {
    if (preload) return;
    await gatewayFromManifest(tasksManifest)(toGateContext(location, params));
    requireOrgStatus({ params });
  },
  component: TasksPage,
  errorComponent: RouteErrorBoundary,
});

// URL-driven dialog over the Tasks list (D24, S:96, Q-T4): it renders nothing;
// the list page reads the URL and opens the New task drawer over itself.
const organizationTaskCreateRoute = createRoute({
  getParentRoute: () => organizationTasksRoute,
  path: 'create',
  head: manifestHead(taskCreateManifest),
  staticData: { manifest: taskCreateManifest },
  validateSearch: validateTaskCreateSearch,
  beforeLoad: async ({ params, preload, location }) => {
    if (preload) return;
    await gatewayFromManifest(taskCreateManifest)(toGateContext(location, params));
    requireOrgStatus({ params });
  },
  component: TaskCreateRoute,
  errorComponent: RouteErrorBoundary,
});

// URL-driven dialog over the Tasks list (D24, S:97): it renders nothing; the
// list page reads the URL and opens the task drawer over itself.
const organizationTaskRoute = createRoute({
  getParentRoute: () => organizationTasksRoute,
  path: '$taskId',
  head: manifestHead(taskManifest),
  staticData: { manifest: taskManifest },
  beforeLoad: async ({ params, preload, location }) => {
    if (preload) return;
    await gatewayFromManifest(taskManifest)(toGateContext(location, params));
    requireOrgStatus({ params });
  },
  component: TaskRoute,
  errorComponent: RouteErrorBoundary,
});

const organizationOfferingsRoute = createRoute({
  getParentRoute: () => organizationShellRoute,
  path: 'offerings',
  head: manifestHead(offeringsManifest),
  staticData: { manifest: offeringsManifest },
  validateSearch: validateOfferingsSearch,
  beforeLoad: async ({ params, preload, location }) => {
    if (preload) return;
    await gatewayFromManifest(offeringsManifest)(toGateContext(location, params));
    requireOrgStatus({ params });
  },
  component: OfferingsPage,
  errorComponent: RouteErrorBoundary,
});

// URL-driven dialogs over the Offerings tab (D24, S:99–100): they render
// nothing; the list page reads the URL and opens the Offering drawer over itself.
const organizationOfferingCreateRoute = createRoute({
  getParentRoute: () => organizationOfferingsRoute,
  path: 'create',
  head: manifestHead(offeringCreateManifest),
  staticData: { manifest: offeringCreateManifest },
  validateSearch: validateOfferingCreateSearch,
  beforeLoad: async ({ params, preload, location }) => {
    if (preload) return;
    await gatewayFromManifest(offeringCreateManifest)(toGateContext(location, params));
    requireOrgStatus({ params });
  },
  component: OfferingCreateRoute,
  errorComponent: RouteErrorBoundary,
});

const organizationOfferingEditRoute = createRoute({
  getParentRoute: () => organizationOfferingsRoute,
  path: '$offeringId/edit',
  head: manifestHead(offeringEditManifest),
  staticData: { manifest: offeringEditManifest },
  beforeLoad: async ({ params, preload, location }) => {
    if (preload) return;
    await gatewayFromManifest(offeringEditManifest)(toGateContext(location, params));
    requireOrgStatus({ params });
  },
  component: OfferingEditRoute,
  errorComponent: RouteErrorBoundary,
});

// The room's tabs are literal child URLs (D24, S:101). The Offers tab is a page
// of its own, so it sits beside the Offerings tab rather than inside its outlet.
const organizationOffersRoute = createRoute({
  getParentRoute: () => organizationShellRoute,
  path: 'offerings/offers',
  head: manifestHead(offersManifest),
  staticData: { manifest: offersManifest },
  validateSearch: validateOffersSearch,
  beforeLoad: async ({ params, preload, location }) => {
    if (preload) return;
    await gatewayFromManifest(offersManifest)(toGateContext(location, params));
    requireOrgStatus({ params });
  },
  component: OffersPage,
  errorComponent: RouteErrorBoundary,
});

// URL-driven dialogs over the Offers tab (D24, S:102–103): they render nothing;
// the Offers page reads the URL and opens the Offer drawer over itself.
const organizationOfferCreateRoute = createRoute({
  getParentRoute: () => organizationOffersRoute,
  path: 'create',
  head: manifestHead(offerCreateManifest),
  staticData: { manifest: offerCreateManifest },
  beforeLoad: async ({ params, preload, location }) => {
    if (preload) return;
    await gatewayFromManifest(offerCreateManifest)(toGateContext(location, params));
    requireOrgStatus({ params });
  },
  component: OfferCreateRoute,
  errorComponent: RouteErrorBoundary,
});

const organizationOfferEditRoute = createRoute({
  getParentRoute: () => organizationOffersRoute,
  path: '$offerId/edit',
  head: manifestHead(offerEditManifest),
  staticData: { manifest: offerEditManifest },
  beforeLoad: async ({ params, preload, location }) => {
    if (preload) return;
    await gatewayFromManifest(offerEditManifest)(toGateContext(location, params));
    requireOrgStatus({ params });
  },
  component: OfferEditRoute,
  errorComponent: RouteErrorBoundary,
});

const organizationUsersRoute = createRoute({
  getParentRoute: () => organizationShellRoute,
  path: 'users',
  head: manifestHead(usersManifest),
  staticData: { manifest: usersManifest },
  validateSearch: validateUsersSearch,
  beforeLoad: async ({ params, preload, location }) => {
    if (preload) return;
    await gatewayFromManifest(usersManifest)(toGateContext(location, params));
    requireOrgStatus({ params });
  },
  component: UsersPage,
  errorComponent: RouteErrorBoundary,
});

// URL-driven dialogs over the Team (D24, S:105–106): each renders nothing; the
// Users page reads the URL and opens the user drawer over itself.
const organizationUserCreateRoute = createRoute({
  getParentRoute: () => organizationUsersRoute,
  path: 'create',
  head: manifestHead(userCreateManifest),
  staticData: { manifest: userCreateManifest },
  beforeLoad: async ({ params, preload, location }) => {
    if (preload) return;
    await gatewayFromManifest(userCreateManifest)(toGateContext(location, params));
    requireOrgStatus({ params });
  },
  component: UserCreateRoute,
  errorComponent: RouteErrorBoundary,
});

const organizationUserEditRoute = createRoute({
  getParentRoute: () => organizationUsersRoute,
  path: '$userId/edit',
  head: manifestHead(userEditManifest),
  staticData: { manifest: userEditManifest },
  // `?from=roles` keeps Roles & access behind the drawer (H:5188).
  validateSearch: validateUserEditSearch,
  beforeLoad: async ({ params, preload, location }) => {
    if (preload) return;
    await gatewayFromManifest(userEditManifest)(toGateContext(location, params));
    requireOrgStatus({ params });
  },
  component: UserEditRoute,
  errorComponent: RouteErrorBoundary,
});

// Roles & access sits beside the Team, not under it: the Team route renders
// the Team, and this tab is a page of its own (`S:107`).
const organizationUsersRolesRoute = createRoute({
  getParentRoute: () => organizationShellRoute,
  path: 'users/roles',
  head: manifestHead(usersRolesManifest),
  staticData: { manifest: usersRolesManifest },
  validateSearch: validateRolesSearch,
  beforeLoad: async ({ params, preload, location }) => {
    if (preload) return;
    await gatewayFromManifest(usersRolesManifest)(toGateContext(location, params));
    requireOrgStatus({ params });
  },
  component: UsersRolesPage,
  errorComponent: RouteErrorBoundary,
});

// Branches sits beside the Team too (`S:108`); its drawers are URL-driven
// dialogs over the list (D24, S:109–110).
const organizationUsersBranchesRoute = createRoute({
  getParentRoute: () => organizationShellRoute,
  path: 'users/branches',
  head: manifestHead(usersBranchesManifest),
  staticData: { manifest: usersBranchesManifest },
  validateSearch: validateBranchesSearch,
  beforeLoad: async ({ params, preload, location }) => {
    if (preload) return;
    await gatewayFromManifest(usersBranchesManifest)(toGateContext(location, params));
    requireOrgStatus({ params });
  },
  component: UsersBranchesPage,
  errorComponent: RouteErrorBoundary,
});

const organizationUsersBranchCreateRoute = createRoute({
  getParentRoute: () => organizationUsersBranchesRoute,
  path: 'create',
  head: manifestHead(branchCreateManifest),
  staticData: { manifest: branchCreateManifest },
  beforeLoad: async ({ params, preload, location }) => {
    if (preload) return;
    await gatewayFromManifest(branchCreateManifest)(toGateContext(location, params));
    requireOrgStatus({ params });
  },
  component: BranchCreateRoute,
  errorComponent: RouteErrorBoundary,
});

const organizationUsersBranchEditRoute = createRoute({
  getParentRoute: () => organizationUsersBranchesRoute,
  path: '$branchId/edit',
  head: manifestHead(branchEditManifest),
  staticData: { manifest: branchEditManifest },
  beforeLoad: async ({ params, preload, location }) => {
    if (preload) return;
    await gatewayFromManifest(branchEditManifest)(toGateContext(location, params));
    requireOrgStatus({ params });
  },
  component: BranchEditRoute,
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
 * → permission), then the org status guard — one function for the Medical and
 * Clinic stock tabs and dialog routes.
 */
function roomLeafGate(manifest: PageManifest) {
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
    await gatewayFromManifest(manifest)(toGateContext(location, params));
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
  beforeLoad: roomLeafGate(medicalPaymentsManifest),
  component: MedicalPaymentsPage,
  errorComponent: RouteErrorBoundary,
});

// URL-driven dialogs over the Medical tabs (D24, S:50–70): each renders
// nothing; the tab page reads the URL and opens the drawer over itself.
const organizationSaleCreateRoute = createRoute({
  getParentRoute: () => organizationMedicalSalesRoute,
  path: 'create',
  head: manifestHead(saleCreateManifest),
  validateSearch: validateMedicalCreateSearch,
  beforeLoad: roomLeafGate(saleCreateManifest),
  component: SaleCreateRoute,
  errorComponent: RouteErrorBoundary,
});

const organizationSaleRoute = createRoute({
  getParentRoute: () => organizationMedicalSalesRoute,
  path: '$saleId',
  head: manifestHead(saleManifest),
  beforeLoad: roomLeafGate(saleManifest),
  component: SaleRoute,
  errorComponent: RouteErrorBoundary,
});

const organizationSaleReturnRoute = createRoute({
  getParentRoute: () => organizationSaleRoute,
  path: 'return',
  head: manifestHead(saleReturnManifest),
  beforeLoad: roomLeafGate(saleReturnManifest),
  component: SaleReturnRoute,
  errorComponent: RouteErrorBoundary,
});

const organizationMedicineCreateRoute = createRoute({
  getParentRoute: () => organizationMedicalMedicinesRoute,
  path: 'create',
  head: manifestHead(medicineCreateManifest),
  validateSearch: validateMedicalCreateSearch,
  beforeLoad: roomLeafGate(medicineCreateManifest),
  component: MedicineCreateRoute,
  errorComponent: RouteErrorBoundary,
});

const organizationMedicineEditRoute = createRoute({
  getParentRoute: () => organizationMedicalMedicinesRoute,
  path: '$medicineId/edit',
  head: manifestHead(medicineEditManifest),
  beforeLoad: roomLeafGate(medicineEditManifest),
  component: MedicineEditRoute,
  errorComponent: RouteErrorBoundary,
});

const organizationPurchaseOrderCreateRoute = createRoute({
  getParentRoute: () => organizationMedicalPurchasesRoute,
  path: 'create',
  head: manifestHead(purchaseOrderCreateManifest),
  validateSearch: validateMedicalCreateSearch,
  beforeLoad: roomLeafGate(purchaseOrderCreateManifest),
  component: PurchaseOrderCreateRoute,
  errorComponent: RouteErrorBoundary,
});

const organizationPurchaseOrderRoute = createRoute({
  getParentRoute: () => organizationMedicalPurchasesRoute,
  path: '$purchaseOrderId',
  head: manifestHead(purchaseOrderManifest),
  beforeLoad: roomLeafGate(purchaseOrderManifest),
  component: PurchaseOrderRoute,
  errorComponent: RouteErrorBoundary,
});

const organizationPurchaseOrderEditRoute = createRoute({
  getParentRoute: () => organizationPurchaseOrderRoute,
  path: 'edit',
  head: manifestHead(purchaseOrderEditManifest),
  beforeLoad: roomLeafGate(purchaseOrderEditManifest),
  component: PurchaseOrderEditRoute,
  errorComponent: RouteErrorBoundary,
});

const organizationPurchaseOrderReceiveRoute = createRoute({
  getParentRoute: () => organizationPurchaseOrderRoute,
  path: 'receive',
  head: manifestHead(purchaseOrderReceiveManifest),
  beforeLoad: roomLeafGate(purchaseOrderReceiveManifest),
  component: PurchaseOrderReceiveRoute,
  errorComponent: RouteErrorBoundary,
});

const organizationSupplierCreateRoute = createRoute({
  getParentRoute: () => organizationMedicalSuppliersRoute,
  path: 'create',
  head: manifestHead(supplierCreateManifest),
  beforeLoad: roomLeafGate(supplierCreateManifest),
  component: SupplierCreateRoute,
  errorComponent: RouteErrorBoundary,
});

const organizationSupplierEditRoute = createRoute({
  getParentRoute: () => organizationMedicalSuppliersRoute,
  path: '$supplierId/edit',
  head: manifestHead(supplierEditManifest),
  beforeLoad: roomLeafGate(supplierEditManifest),
  component: SupplierEditRoute,
  errorComponent: RouteErrorBoundary,
});

const organizationManufacturerCreateRoute = createRoute({
  getParentRoute: () => organizationMedicalManufacturersRoute,
  path: 'create',
  head: manifestHead(manufacturerCreateManifest),
  beforeLoad: roomLeafGate(manufacturerCreateManifest),
  component: ManufacturerCreateRoute,
  errorComponent: RouteErrorBoundary,
});

const organizationManufacturerEditRoute = createRoute({
  getParentRoute: () => organizationMedicalManufacturersRoute,
  path: '$manufacturerId/edit',
  head: manifestHead(manufacturerEditManifest),
  beforeLoad: roomLeafGate(manufacturerEditManifest),
  component: ManufacturerEditRoute,
  errorComponent: RouteErrorBoundary,
});

const organizationMrCreateRoute = createRoute({
  getParentRoute: () => organizationMedicalMrsRoute,
  path: 'create',
  head: manifestHead(mrCreateManifest),
  beforeLoad: roomLeafGate(mrCreateManifest),
  component: MrCreateRoute,
  errorComponent: RouteErrorBoundary,
});

const organizationMrEditRoute = createRoute({
  getParentRoute: () => organizationMedicalMrsRoute,
  path: '$mrId/edit',
  head: manifestHead(mrEditManifest),
  beforeLoad: roomLeafGate(mrEditManifest),
  component: MrEditRoute,
  errorComponent: RouteErrorBoundary,
});

const organizationMrVisitCreateRoute = createRoute({
  getParentRoute: () => organizationMedicalMrsRoute,
  path: '$mrId/visits/create',
  head: manifestHead(mrVisitCreateManifest),
  beforeLoad: roomLeafGate(mrVisitCreateManifest),
  component: MrVisitCreateRoute,
  errorComponent: RouteErrorBoundary,
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

const organizationStockItemsRoute = createRoute({
  getParentRoute: () => organizationStockRoute,
  path: 'items',
  head: manifestHead(stockItemsManifest),
  beforeLoad: async ({ params, preload, location }) => {
    if (preload) return;
    await gatewayFromManifest(stockItemsManifest)(toGateContext(location, params));
    requireOrgStatus({ params });
  },
  component: StockItemsPage,
  errorComponent: RouteErrorBoundary,
});

// ── Personal space (/dashboard) ──
// Personal organizations land on root URLs — no `$organizationSlug` in the path.
// The active org comes from the session context (me/context / JWT), not the URL,
// so this shell only requires an authenticated session. (Dual-URL, research/11
// §3.3.) The org-scoped team space remains `/organization/$organizationSlug/*`.
const personalShellRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'personal-app',
  beforeLoad: async ({ location, preload }) => {
    if (preload) return;
    await requireAuth(location.href);
    requirePersonalDeployment({});
    await requirePersonalDashboardWorkspace({ redirectFrom: location.href });
  },
  loader: () => preloadSessionAppShell(),
  component: function PersonalShellRoute() {
    return (
      <Suspense fallback={<FullPageSpinner />}>
        <PersonalShell />
      </Suspense>
    );
  },
  errorComponent: RouteErrorBoundary,
});

const personalDashboardRoute = createRoute({
  getParentRoute: () => personalShellRoute,
  path: '/dashboard',
  head: manifestHead(dashboardManifest),
  staticData: { manifest: dashboardManifest },
  beforeLoad: async ({ preload, location, params }) => {
    if (preload) return;
    await gatewayFromManifest(dashboardManifest)(toGateContext(location, params));
  },
  component: DashboardPage,
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
    organizationDashboardRoute,
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
      organizationPatientPrescriptionsRoute,
      organizationPatientTreatmentsRoute,
      organizationPatientImagesRoute.addChildren([
        organizationPatientPhotoRoute,
        organizationPatientPhotoEditRoute,
      ]),
      organizationPatientReportsRoute,
      organizationPatientInvoicesRoute,
      organizationPatientPaymentsRoute,
      organizationPatientPackagesRoute,
      organizationPatientNotesRoute,
      organizationPatientEditRoute,
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
    ]),
    organizationStockRoute.addChildren([
      organizationStockIndexRoute,
      organizationStockItemsRoute,
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
    organizationUsersBranchesRoute.addChildren([
      organizationUsersBranchCreateRoute,
      organizationUsersBranchEditRoute,
    ]),
    organizationNotFoundRoute,
  ]),
  personalShellRoute.addChildren([personalDashboardRoute]),
  notFoundRoute,
]);

/**
 * When the router shows its pending component, and for how long — two policies,
 * because "is anything on screen yet?" has two answers.
 *
 * **BOOT** — until the first navigation resolves. Nothing is on screen to keep:
 * the HTML splash is up, and the pending component (`FullPageSpinner`) renders
 * nothing of its own but HOLDS that splash. So it mounts at once (`pendingMs: 0`)
 * on EVERY cold URL — `/`, a bookmarked dashboard, an emailed invite link — which
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
  }
}
