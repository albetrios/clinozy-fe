import { screen, waitFor } from '@testing-library/react';
import { createInstance, type i18n as I18n } from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';
import enClinic from '@/locales/en/clinic.json';
import enCommon from '@/locales/en/common.json';
import enErrors from '@/locales/en/errors.json';
import enLayout from '@/locales/en/layout.json';
import enPatients from '@/locales/en/patients.json';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useDevicePrefsStore } from '@/shared/store/useDevicePrefsStore/index.ts';

import { PATIENTS_TABLE_ID } from '../../patients.constants.ts';
import { PatientsPage } from '../../PatientsPage.tsx';
import { renderPatientsRoutes, resetPatientsRoutes } from './patients-test-router.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: notifyMock,
  TOAST_DURATION_MS: { default: 5_200, error: 9_000 },
}));

const PATIENTS = '/organization/acme/patients';

/**
 * What the Patients route has loaded in the app, and nothing else: the boot
 * bundle's namespaces (`common`, `errors`, `layout`), the org shell's
 * (`clinic` — `routeTree.tsx` › `OrganizationShell`) and the room's own
 * (`patients` — › `PatientsPage`). The suite's shared instance holds every
 * namespace, so a label read through a namespace the route never loads, or
 * through the wrong one, passes there and shows its key path in the app.
 */
const ROUTE_RESOURCES = {
  [I18N_NAMESPACES.common]: enCommon,
  [I18N_NAMESPACES.errors]: enErrors,
  [I18N_NAMESPACES.layout]: enLayout,
  [I18N_NAMESPACES.clinic]: enClinic,
  [I18N_NAMESPACES.patients]: enPatients,
};

/** A key path of those namespaces showing as text, e.g. `patients.types.lhr`. */
const RAW_KEY = new RegExp(
  `\\b(${[...Object.keys(enClinic), ...Object.keys(enPatients)].join('|')})\\.[A-Za-z]`,
);

let routeI18n: I18n;

beforeAll(async () => {
  routeI18n = createInstance();
  await routeI18n.init({
    lng: 'en',
    fallbackLng: 'en',
    defaultNS: I18N_NAMESPACES.common,
    ns: Object.keys(ROUTE_RESOURCES),
    resources: { en: ROUTE_RESOURCES },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
});

beforeEach(() => {
  viewport.tier = 'desktop';
  resetClinicFixtures();
  // Every column, the ones hidden by default (Gender, Conversion, Age) included.
  useDevicePrefsStore.setState({ hiddenColumns: { [PATIENTS_TABLE_ID]: [] } });
});
afterEach(() => {
  resetPatientsRoutes();
  resetClinicFixtures();
  useDevicePrefsStore.setState({ hiddenColumns: {} });
});

describe('the Patients room with only its route’s namespaces loaded', () => {
  it('labels every cell — no key path shows', async () => {
    renderPatientsRoutes(PATIENTS, PatientsPage, { i18n: routeI18n });
    await waitFor(() =>
      expect(screen.getAllByTestId('patients-table-row').length).toBeGreaterThan(0),
    );
    const dharti = screen
      .getAllByTestId('patients-table-row')
      .find((row) => row.textContent?.includes('Dharti Galani'));
    // Type and Status (`clinic` › patients), Gender (`clinic` › personCard).
    expect(dharti).toHaveTextContent('Aesthetic');
    expect(dharti).toHaveTextContent('Regular');
    expect(dharti).toHaveTextContent('Female');
    expect(screen.getByRole('columnheader', { name: /Conversion/ })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(RAW_KEY);
  });

  it('opens the New patient drawer with every label in place', async () => {
    renderPatientsRoutes(`${PATIENTS}/create`, PatientsPage, { i18n: routeI18n });
    const drawer = await screen.findByTestId('patient-drawer');
    // The drawer's copy is `clinic` (it is shared — quick-add stacks it on other rooms).
    expect(drawer).toHaveTextContent('New patient');
    expect(drawer).toHaveTextContent('Contact & personal');
    expect(drawer).toHaveTextContent('primary · WhatsApp');
    expect(drawer).toHaveTextContent('Walk-in today');
    expect(drawer.textContent).not.toMatch(RAW_KEY);
  });
});
