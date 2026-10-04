import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { fetchPatientFile } from '@/shared/api/clinic/patient-file-api.ts';
import { resetPreferencesFixture } from '@/shared/api/clinic/preferences-api.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import {
  patientFileUrl,
  renderPatientFile,
  resetPatientFile,
} from './__tests__/integration/patient-file-test-router.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

const DHARTI = patientRef('Dharti Galani');
const LIST = '/organization/acme/patients';

const layout = () => screen.getByTestId('patient-file-layout');
const tabs = () =>
  within(screen.getByRole('tablist', { name: 'Patient sections' }))
    .getAllByRole('tab')
    .map((tab) => tab.textContent);

beforeEach(() => {
  viewport.tier = 'desktop';
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
  resetPreferencesFixture();
});
afterEach(() => {
  resetPatientFile();
  resetClinicFixtures();
});

describe('the patient file layout (KICKOFF §6.6)', () => {
  it('lands on the Overview, keeping the list’s `activity`', async () => {
    const { router } = renderPatientFile(`${patientFileUrl(DHARTI)}?activity=open`);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(patientFileUrl(DHARTI, '/timeline')),
    );
    expect(router.state.location.search).toMatchObject({ activity: 'open' });
    expect(await screen.findByTestId('patient-section-timeline')).toBeInTheDocument();
  });

  it('sends an unknown section to the Overview (S:33)', async () => {
    const { router } = renderPatientFile(patientFileUrl(DHARTI, '/secret'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(patientFileUrl(DHARTI, '/timeline')),
    );
  });

  it('draws the file bar: Back, the breadcrumb, the pinned tabs and the open one', async () => {
    const { container } = renderPatientFile(patientFileUrl(DHARTI, '/timeline'));
    await screen.findByTestId('patient-section-timeline');
    expect(screen.getByTestId('patient-file-back')).toHaveAccessibleName(
      'Back to patients',
    );
    expect(
      screen.getAllByRole('heading', { level: 1, name: 'Dharti Galani' }),
    ).not.toHaveLength(0);
    // The default pins (D26), then the open Overview, unpinned (its dot).
    expect(tabs()).toEqual([
      'Clinical notes',
      'Visits',
      'Prescriptions',
      'Invoices',
      'OverviewNot pinned · shown while open',
    ]);
    expect(screen.getByTestId('patient-file-tab-timeline')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    // The identity line is always masked.
    expect(layout()).toHaveTextContent('#3508 · +91 ••••• •3212');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('moves between the tabs with ← / →, opening each', async () => {
    const user = userEvent.setup();
    const { router } = renderPatientFile(patientFileUrl(DHARTI, '/visits'));
    await screen.findByTestId('patient-section-visits');
    screen.getByTestId('patient-file-tab-visits').focus();
    await user.keyboard('{ArrowRight}');
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        patientFileUrl(DHARTI, '/prescriptions'),
      ),
    );
    await waitFor(() =>
      expect(screen.getByTestId('patient-file-tab-prescriptions')).toHaveFocus(),
    );
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(patientFileUrl(DHARTI, '/overview')),
    );
  });

  it('opens Activity from a link, then keeps the session’s choice', async () => {
    const user = userEvent.setup();
    const { router } = renderPatientFile(
      `${patientFileUrl(DHARTI, '/overview')}?activity=open`,
    );
    await screen.findByTestId('patient-file-activity-column');
    const toggle = screen.getByTestId('patient-file-activity');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toHaveAccessibleName('Hide messages & activity');
    expect(layout()).toHaveAttribute('data-activity', 'open');

    await user.click(toggle);
    await waitFor(() =>
      expect(
        screen.queryByTestId('patient-file-activity-column'),
      ).not.toBeInTheDocument(),
    );
    expect(router.state.location.search).not.toHaveProperty('activity');
    expect(useUIStore.getState().fileActivityOpen).toBe(false);
    expect(screen.getByTestId('patient-file-activity')).toHaveAccessibleName(
      'Show messages & activity',
    );
    // Another section, no `activity`: the column stays as it was left.
    await user.click(screen.getByTestId('patient-file-tab-visits'));
    await screen.findByTestId('patient-section-visits');
    expect(layout()).toHaveAttribute('data-activity', 'closed');
  });

  it('starts with Activity closed on a phone and open from md (no link, no state)', async () => {
    viewport.tier = 'phone';
    const phone = renderPatientFile(patientFileUrl(DHARTI, '/visits'));
    await screen.findByTestId('patient-section-visits');
    expect(layout()).toHaveAttribute('data-activity', 'closed');
    phone.unmount();

    viewport.tier = 'tablet';
    renderPatientFile(patientFileUrl(DHARTI, '/visits'));
    await screen.findByTestId('patient-file-activity-column');
    expect(layout()).toHaveAttribute('data-activity', 'open');
  });

  it('shows the rail from lg while Activity is closed and from xl while open (D23)', async () => {
    renderPatientFile(patientFileUrl(DHARTI, '/visits'));
    const rail = await screen.findByTestId('patient-rail');
    expect(rail).toHaveClass(
      'hidden',
      'lg:group-data-[activity=closed]/file:flex',
      'xl:flex',
    );
    expect(layout()).toHaveClass('group/file');
  });

  it('opens a section from the sections popover and pins one to the bar', async () => {
    const user = userEvent.setup();
    const { router } = renderPatientFile(patientFileUrl(DHARTI, '/visits'));
    await screen.findByTestId('patient-section-visits');
    await user.click(screen.getByTestId('patient-file-sections'));
    const panel = await screen.findByTestId('patient-file-sections-panel');
    expect(panel).toHaveAccessibleName('Patient file sections');
    expect(within(panel).getByRole('group', { name: 'Billing' })).toBeInTheDocument();
    expect(
      within(panel).getByTestId('patient-file-sections-tile-visits'),
    ).toHaveTextContent('Open now');

    await user.click(within(panel).getByTestId('patient-file-sections-pin-images'));
    // The bar behind the (modal) popover gains the pin at once.
    await waitFor(() =>
      expect(screen.getByTestId('patient-file-tab-images')).toHaveTextContent('Photos'),
    );
    await user.click(within(panel).getByTestId('patient-file-sections-tile-reports'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(patientFileUrl(DHARTI, '/reports')),
    );
    expect(screen.queryByTestId('patient-file-sections-panel')).not.toBeInTheDocument();
  });

  it('offers each Add-to-record item the member may use', async () => {
    const user = userEvent.setup();
    renderPatientFile(patientFileUrl(DHARTI, '/visits'), { role: 'front_desk' });
    await screen.findByTestId('patient-section-visits');
    await user.click(screen.getByTestId('patient-file-add'));
    const menu = await screen.findByTestId('patient-file-add-menu');
    expect(within(menu).getByText('Add for Dharti')).toBeInTheDocument();
    // Front desk: no Rx or treatment (the role-named gates, S:35, 38).
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Invoice', 'Payment', 'Photo', 'Appointment', 'Report', 'Note']);
  });

  it('shows a Therapist the treatment gate alone in the Add menu', async () => {
    const user = userEvent.setup();
    renderPatientFile(patientFileUrl(DHARTI, '/visits'), { role: 'therapist' });
    await screen.findByTestId('patient-section-visits');
    await user.click(screen.getByTestId('patient-file-add'));
    const menu = await screen.findByTestId('patient-file-add-menu');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Treatment']);
  });

  it('sends an Accountant to Invoices and shows the billing sections alone (Q-F1)', async () => {
    const { router } = renderPatientFile(patientFileUrl(DHARTI, '/timeline'), {
      role: 'accountant',
    });
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(patientFileUrl(DHARTI, '/invoices')),
    );
    await screen.findByTestId('patient-section-invoices');
    expect(tabs()).toEqual(['Invoices']);
  });

  it('goes back to the list on an Esc nothing else takes', async () => {
    const { router } = renderPatientFile(patientFileUrl(DHARTI, '/visits'));
    await screen.findByTestId('patient-section-visits');
    fireEvent.keyDown(document.body, { key: 'Escape' });
    await waitFor(() => expect(router.state.location.pathname).toBe(LIST));
  });

  it('keeps the file on an Esc typed into a field', async () => {
    const { router } = renderPatientFile(
      `${patientFileUrl(DHARTI, '/visits')}?activity=open`,
    );
    await screen.findByTestId('patient-file-activity-column');
    const box = await screen.findByRole('textbox');
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(router.state.location.pathname).toBe(patientFileUrl(DHARTI, '/visits'));
  });

  it('says "Patient not found" and goes back to the list for a deleted patient', async () => {
    await clinicFixtures.patients.remove(DHARTI, 'mistake', null);
    const { router } = renderPatientFile(patientFileUrl(DHARTI, '/visits'));
    await waitFor(() => expect(router.state.location.pathname).toBe(LIST));
    expect(notifyMock.info).toHaveBeenCalledWith(
      'Patient not found · it may have been deleted',
    );
  });

  it('masks what they owe until the due eye is pressed (Q-F4)', async () => {
    const user = userEvent.setup();
    const owing = clinicFixtures.patients
      .snapshot()
      .map((patient) => patient.id)
      .find(
        (id) =>
          clinicFixtures.invoices.snapshot((invoice) => invoice.patientId === id).length,
      );
    if (!owing) throw new Error('no patient with invoices');
    const file = await fetchPatientFile(owing);
    renderPatientFile(patientFileUrl(owing, '/visits'));
    await screen.findByTestId('patient-rail');
    if (file.due === 0) {
      expect(screen.getByTestId('patient-rail')).toHaveTextContent(
        'All paid · nothing due',
      );
      return;
    }
    expect(screen.getByTestId('patient-rail-due')).toHaveTextContent('₹ ••••');
    await user.click(screen.getByTestId('patient-rail-due-eye'));
    expect(screen.getByTestId('patient-rail-due')).not.toHaveTextContent('••••');
  });

  it('opens Edit patient over the section it came from, and closes back to it', async () => {
    const user = userEvent.setup();
    const { router } = renderPatientFile(patientFileUrl(DHARTI, '/prescriptions'));
    await screen.findByTestId('patient-section-prescriptions');
    await user.click(screen.getByTestId('patient-rail-edit'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(patientFileUrl(DHARTI, '/edit')),
    );
    expect(router.state.location.search).toMatchObject({ from: 'prescriptions' });
    expect(await screen.findByTestId('patient-drawer')).toBeInTheDocument();
    expect(screen.getByTestId('patient-section-prescriptions')).toBeInTheDocument();

    await user.click(screen.getByTestId('patient-drawer-close'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        patientFileUrl(DHARTI, '/prescriptions'),
      ),
    );
  });
});
