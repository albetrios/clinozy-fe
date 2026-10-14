/**
 * The clinic rooms' pages and tabs (KICKOFF §4) — every room island under the
 * organization shell, the Invoice drawer's host, and the org home's empty state
 * that stands in for a room when none is open — behind ONE dynamic import
 * from `routeTree.tsx`, as the patient file's sections are behind
 * `patient-id.sections.ts`.
 *
 * Each room is still its own lazy chunk. What leaves the entry chunk is the
 * import of each: Vite gives every `import()` a preload list naming each chunk
 * the room shares, and the entry carries every list and every chunk name in
 * them — the largest piece of route registration left on the first paint, for
 * rooms a load opens one of. `roomRoute(name)` in `routeTree.tsx` loads this
 * module, then the room's chunk; the org shell's loader and the signed-in
 * warm-up fetch this module ahead of time, so a navigation does not wait on
 * the second hop.
 */
import { lazyRouteComponent } from '@tanstack/react-router';

import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

import { localizedRoute } from './localized-route.ts';

/** Every clinic room's page or tab component, by the name `roomRoute(name)` mounts it under. */
export const ROOM_ROUTES = {
  // The org home when no room is open to the member (L-63). Its words are
  // `app`'s, which load with the org shell.
  AppHomeEmpty: lazyRouteComponent(
    () =>
      import('@/pages/organization/$organizationSlug/components/AppHomeEmpty/index.ts'),
    'AppHomeEmpty',
  ),
  // Today's work queue reads the Tasks rule copy (one task model, Q-T3): `tasks` loads with it.
  TodayPage: lazyRouteComponent(
    localizedRoute(
      [I18N_NAMESPACES.today, I18N_NAMESPACES.tasks],
      () => import('@/pages/organization/$organizationSlug/today/today.route.tsx'),
    ),
    'Component',
  ),
  LeadsPage: lazyRouteComponent(
    localizedRoute(
      [I18N_NAMESPACES.leads],
      () => import('@/pages/organization/$organizationSlug/leads/leads.route.tsx'),
    ),
    'Component',
  ),
  AppointmentsPage: lazyRouteComponent(
    localizedRoute(
      [I18N_NAMESPACES.appointments],
      () =>
        import('@/pages/organization/$organizationSlug/appointments/appointments.route.tsx'),
    ),
    'Component',
  ),
  PatientsPage: lazyRouteComponent(
    localizedRoute(
      [I18N_NAMESPACES.patients],
      () => import('@/pages/organization/$organizationSlug/patients/patients.route.tsx'),
    ),
    'Component',
  ),
  PaymentsPage: lazyRouteComponent(
    localizedRoute(
      [I18N_NAMESPACES.payments],
      () => import('@/pages/organization/$organizationSlug/payments/payments.route.tsx'),
    ),
    'Component',
  ),
  PaymentsPendingPage: lazyRouteComponent(
    localizedRoute(
      [I18N_NAMESPACES.payments],
      () =>
        import('@/pages/organization/$organizationSlug/payments/pending/pending.route.tsx'),
    ),
    'Component',
  ),
  TasksPage: lazyRouteComponent(
    localizedRoute(
      [I18N_NAMESPACES.tasks],
      () => import('@/pages/organization/$organizationSlug/tasks/tasks.route.tsx'),
    ),
    'Component',
  ),
  OfferingsPage: lazyRouteComponent(
    localizedRoute(
      [I18N_NAMESPACES.offerings],
      () =>
        import('@/pages/organization/$organizationSlug/offerings/offerings.route.tsx'),
    ),
    'Component',
  ),
  // The Offers tab is the room's second page (D24): its own chunk, the room's namespace.
  OffersPage: lazyRouteComponent(
    localizedRoute(
      [I18N_NAMESPACES.offerings],
      () =>
        import('@/pages/organization/$organizationSlug/offerings/offers/offers.route.tsx'),
    ),
    'Component',
  ),
  UsersPage: lazyRouteComponent(
    localizedRoute(
      [I18N_NAMESPACES.users],
      () => import('@/pages/organization/$organizationSlug/users/users.route.tsx'),
    ),
    'Component',
  ),
  UsersRolesPage: lazyRouteComponent(
    localizedRoute(
      [I18N_NAMESPACES.users],
      () => import('@/pages/organization/$organizationSlug/users/roles/roles.route.tsx'),
    ),
    'Component',
  ),
  UsersBranchesPage: lazyRouteComponent(
    localizedRoute(
      [I18N_NAMESPACES.users],
      () =>
        import('@/pages/organization/$organizationSlug/users/branches/branches.route.tsx'),
    ),
    'Component',
  ),
  MedicalLayout: lazyRouteComponent(
    localizedRoute(
      [I18N_NAMESPACES.medical],
      () => import('@/pages/organization/$organizationSlug/medical/medical.route.tsx'),
    ),
    'Component',
  ),
  MedicalSalesPage: lazyRouteComponent(
    localizedRoute(
      [I18N_NAMESPACES.medical],
      () =>
        import('@/pages/organization/$organizationSlug/medical/sales/sales.route.tsx'),
    ),
    'Component',
  ),
  MedicalMedicinesPage: lazyRouteComponent(
    localizedRoute(
      [I18N_NAMESPACES.medical],
      () =>
        import('@/pages/organization/$organizationSlug/medical/medicines/medicines.route.tsx'),
    ),
    'Component',
  ),
  MedicalPurchasesPage: lazyRouteComponent(
    localizedRoute(
      [I18N_NAMESPACES.medical],
      () =>
        import('@/pages/organization/$organizationSlug/medical/purchases/purchases.route.tsx'),
    ),
    'Component',
  ),
  MedicalSuppliersPage: lazyRouteComponent(
    localizedRoute(
      [I18N_NAMESPACES.medical],
      () =>
        import('@/pages/organization/$organizationSlug/medical/suppliers/suppliers.route.tsx'),
    ),
    'Component',
  ),
  MedicalManufacturersPage: lazyRouteComponent(
    localizedRoute(
      [I18N_NAMESPACES.medical],
      () =>
        import('@/pages/organization/$organizationSlug/medical/manufacturers/manufacturers.route.tsx'),
    ),
    'Component',
  ),
  MedicalMrsPage: lazyRouteComponent(
    localizedRoute(
      [I18N_NAMESPACES.medical],
      () => import('@/pages/organization/$organizationSlug/medical/mrs/mrs.route.tsx'),
    ),
    'Component',
  ),
  MedicalPaymentsPage: lazyRouteComponent(
    localizedRoute(
      // The ledger's words are the Payments room's (`LEDGER_NS`).
      [I18N_NAMESPACES.medical, I18N_NAMESPACES.payments],
      () =>
        import('@/pages/organization/$organizationSlug/medical/payments/payments.route.tsx'),
    ),
    'Component',
  ),
  MedicalCreditsPage: lazyRouteComponent(
    localizedRoute(
      // Pending's words are the Payments room's (`PAYMENTS_NS`).
      [I18N_NAMESPACES.medical, I18N_NAMESPACES.payments],
      () =>
        import('@/pages/organization/$organizationSlug/medical/credits/credits.route.tsx'),
    ),
    'Component',
  ),
  StockLayout: lazyRouteComponent(
    localizedRoute(
      [I18N_NAMESPACES.appStock],
      () => import('@/pages/organization/$organizationSlug/stock/stock.route.tsx'),
    ),
    'Component',
  ),
  StockItemsPage: lazyRouteComponent(
    localizedRoute(
      [I18N_NAMESPACES.appStock],
      () => import('@/pages/organization/$organizationSlug/stock/items/items.route.tsx'),
    ),
    'Component',
  ),
  StockPurchasesPage: lazyRouteComponent(
    localizedRoute(
      [I18N_NAMESPACES.appStock],
      () =>
        import('@/pages/organization/$organizationSlug/stock/purchases/purchases.route.tsx'),
    ),
    'Component',
  ),
  StockMovementsPage: lazyRouteComponent(
    localizedRoute(
      [I18N_NAMESPACES.appStock],
      () =>
        import('@/pages/organization/$organizationSlug/stock/movements/movements.route.tsx'),
    ),
    'Component',
  ),
  StockVendorsPage: lazyRouteComponent(
    localizedRoute(
      [I18N_NAMESPACES.appStock],
      () =>
        import('@/pages/organization/$organizationSlug/stock/vendors/vendors.route.tsx'),
    ),
    'Component',
  ),
  InvoicesHost: lazyRouteComponent(
    () => import('@/pages/organization/$organizationSlug/invoices/invoices.route.tsx'),
    'Component',
  ),
} as const;
