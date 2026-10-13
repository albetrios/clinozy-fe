import { beforeAll, describe, expect, it, vi } from 'vitest';

import type * as LoadNamespaceModule from '@/lib/i18n/load-namespace.ts';

import type { ROOM_ROUTES } from './room-routes.ts';

/*
 * Each name `roomRoute(name)` mounts in `routeTree.tsx` loads its own room's
 * route module, and only that one (L-54). Every room module exports the same
 * `Component`, so a swapped import would type-check and put the wrong page at
 * a URL; this pins the registry's names to their islands.
 */

vi.mock('@/lib/i18n/load-namespace.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof LoadNamespaceModule>()),
  ensureNamespace: () => Promise.resolve(),
}));

type RoomName = keyof typeof ROOM_ROUTES;

const ORG = '@/pages/organization/$organizationSlug';
const ROOM_MODULES: Record<RoomName, string> = {
  AppHomeEmpty: `${ORG}/components/AppHomeEmpty/index.ts`,
  TodayPage: `${ORG}/today/today.route.tsx`,
  LeadsPage: `${ORG}/leads/leads.route.tsx`,
  AppointmentsPage: `${ORG}/appointments/appointments.route.tsx`,
  PatientsPage: `${ORG}/patients/patients.route.tsx`,
  PaymentsPage: `${ORG}/payments/payments.route.tsx`,
  PaymentsPendingPage: `${ORG}/payments/pending/pending.route.tsx`,
  TasksPage: `${ORG}/tasks/tasks.route.tsx`,
  OfferingsPage: `${ORG}/offerings/offerings.route.tsx`,
  OffersPage: `${ORG}/offerings/offers/offers.route.tsx`,
  UsersPage: `${ORG}/users/users.route.tsx`,
  UsersRolesPage: `${ORG}/users/roles/roles.route.tsx`,
  UsersBranchesPage: `${ORG}/users/branches/branches.route.tsx`,
  MedicalLayout: `${ORG}/medical/medical.route.tsx`,
  MedicalSalesPage: `${ORG}/medical/sales/sales.route.tsx`,
  MedicalMedicinesPage: `${ORG}/medical/medicines/medicines.route.tsx`,
  MedicalPurchasesPage: `${ORG}/medical/purchases/purchases.route.tsx`,
  MedicalSuppliersPage: `${ORG}/medical/suppliers/suppliers.route.tsx`,
  MedicalManufacturersPage: `${ORG}/medical/manufacturers/manufacturers.route.tsx`,
  MedicalMrsPage: `${ORG}/medical/mrs/mrs.route.tsx`,
  MedicalPaymentsPage: `${ORG}/medical/payments/payments.route.tsx`,
  StockLayout: `${ORG}/stock/stock.route.tsx`,
  StockItemsPage: `${ORG}/stock/items/items.route.tsx`,
  StockPurchasesPage: `${ORG}/stock/purchases/purchases.route.tsx`,
  StockMovementsPage: `${ORG}/stock/movements/movements.route.tsx`,
  StockVendorsPage: `${ORG}/stock/vendors/vendors.route.tsx`,
  InvoicesHost: `${ORG}/invoices/invoices.route.tsx`,
};

/** The room modules loaded so far, in order — each stands in for its island. */
const loaded: RoomName[] = [];
let rooms: typeof ROOM_ROUTES;

beforeAll(async () => {
  for (const [name, path] of Object.entries(ROOM_MODULES)) {
    vi.doMock(path, () => {
      loaded.push(name as RoomName);
      return { Component: () => null, AppHomeEmpty: () => null };
    });
  }
  ({ ROOM_ROUTES: rooms } = await import('./room-routes.ts'));
});

describe('the room-route registry (L-54)', () => {
  it('names every room the table above names — no more, no fewer', () => {
    expect(Object.keys(rooms).sort()).toEqual(Object.keys(ROOM_MODULES).sort());
    expect(loaded).toEqual([]);
  });

  it.each(Object.keys(ROOM_MODULES) as RoomName[])(
    '%s loads its own island, and only that one',
    async (name) => {
      const before = loaded.length;
      await rooms[name].preload?.();
      expect(loaded.slice(before)).toEqual([name]);
    },
  );
});
