import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { fetchPatientFile } from '@/shared/api/clinic/patient-file-api.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';

import {
  patientFileUrl,
  renderInPatientFile,
  renderPatientFile,
  resetPatientFile,
} from '../../../__tests__/integration/patient-file-test-router.tsx';
import { OverviewBento } from './OverviewBento.tsx';
import type * as SmartNoteModule from './smart-note.ts';
import { loadSmartNoteReading } from './smart-note.ts';

vi.mock('./smart-note.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof SmartNoteModule>();
  return { ...actual, loadSmartNoteReading: vi.fn(actual.loadSmartNoteReading) };
});

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
const FILE = `/organization/acme/patients/${DHARTI}`;
const CARDS = [
  'clinical',
  'visits',
  'photos',
  'packages',
  'prescriptions',
  'treatments',
  'billing',
  'reports',
  'notes',
];

/** The file on Dharti's Overview, for a member previewed as `role`. */
const openOverview = (role?: Parameters<typeof renderPatientFile>[1]) => {
  const user = userEvent.setup();
  const view = renderPatientFile(patientFileUrl(DHARTI, '/timeline'), role);
  return { user, ...view };
};
const card = (name: string) => screen.findByTestId(`overview-card-${name}`);
const path = (router: ReturnType<typeof renderPatientFile>['router']) =>
  router.state.location.pathname;

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  resetPatientFile();
  resetClinicFixtures();
  useLocaleStore.setState({ locale: 'en' });
});

describe('OverviewBento (KICKOFF §6.6 Overview, H:769–779)', () => {
  it('lays out the nine cards, each opening its section', async () => {
    const { user, router } = openOverview();
    await card('clinical');
    expect(
      CARDS.map((name) => screen.queryByTestId(`overview-card-${name}`) !== null),
    ).toEqual(CARDS.map(() => true));
    await user.click(screen.getByRole('button', { name: 'Open Visits' }));
    await waitFor(() => expect(path(router)).toBe(`${FILE}/visits`));
  });

  it('is accessible', async () => {
    const file = await fetchPatientFile(DHARTI);
    const { container } = renderInPatientFile(<OverviewBento />, {
      file,
      section: 'timeline',
    });
    await within(await card('visits')).findByText('Peel · 30 min');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('leaves Billing and the clinical writes out for a member who may not', async () => {
    openOverview({ role: 'therapist' });
    await card('clinical');
    expect(screen.queryByTestId('overview-card-billing')).not.toBeInTheDocument();
    expect(screen.queryByTestId('overview-smart-note')).not.toBeInTheDocument();
    expect(screen.queryByTestId('overview-note-input')).not.toBeInTheDocument();
    expect(screen.queryByTestId('overview-card-packages-use')).not.toBeInTheDocument();
    expect(screen.queryByTestId('overview-card-visits-book')).not.toBeInTheDocument();
  });

  it('files a smart note’s words as chips at once', async () => {
    const { user } = openOverview();
    const clinical = await card('clinical');
    await user.type(
      within(clinical).getByRole('textbox', { name: 'Smart note' }),
      'hair fall 2 months, suggest PRP',
    );
    await user.click(within(clinical).getByRole('button', { name: 'Add' }));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('2 items added from your note'),
    );
    expect(within(clinical).getByText('Hair fall')).toBeInTheDocument();
    expect(within(clinical).getByText('PRP')).toBeInTheDocument();
    expect(within(clinical).getByRole('textbox', { name: 'Smart note' })).toHaveValue('');
    await waitFor(async () =>
      expect((await clinicFixtures.patients.get(DHARTI)).treatmentSuggestions).toMatch(
        /PRP$/,
      ),
    );

    await user.type(
      within(clinical).getByRole('textbox', { name: 'Smart note' }),
      'ok{Enter}',
    );
    await waitFor(() =>
      expect(notifyMock.info).toHaveBeenCalledWith('Nothing recognised yet'),
    );
  });

  it('reads a smart note in the UI language, its example in the placeholder', async () => {
    useLocaleStore.setState({ locale: 'de' });
    const { user } = openOverview();
    const clinical = await card('clinical');
    const input = within(clinical).getByRole('textbox', { name: 'Smart note' });
    expect(input).toHaveAttribute(
      'placeholder',
      'Smart note · type naturally, e.g. hair fall 2 months, suggest PRP',
    );
    await user.type(input, 'Haarausfall und Juckreiz, PRP vorschlagen{Enter}');
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('3 items added from your note'),
    );
    expect(within(clinical).getByText('Haarausfall')).toBeInTheDocument();
    expect(within(clinical).getByText('Juckreiz')).toBeInTheDocument();
  });

  it('says when a smart note’s words cannot load, and Retry reads it', async () => {
    const { user } = openOverview();
    const clinical = await card('clinical');
    vi.mocked(loadSmartNoteReading).mockRejectedValueOnce(new Error('offline'));
    await user.type(
      within(clinical).getByRole('textbox', { name: 'Smart note' }),
      'acne on the chin{Enter}',
    );
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith('Could not load data.', {
        action: { label: 'Try again', onClick: expect.any(Function) },
      }),
    );
    expect(notifyMock.info).not.toHaveBeenCalled();
    expect(within(clinical).getByRole('textbox', { name: 'Smart note' })).toHaveValue(
      'Acne on the chin',
    );

    const [, options] = notifyMock.error.mock.calls[0] as [
      string,
      { action: { onClick: () => void } },
    ];
    act(() => options.action.onClick());
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('1 item added from your note'),
    );
    expect(within(clinical).getByText('Acne')).toBeInTheDocument();
  });

  it('opens New prescription with a line for each medicine a smart note names', async () => {
    const { user, router } = openOverview();
    const clinical = await card('clinical');
    const input = within(clinical).getByRole('textbox', { name: 'Smart note' });
    // The Rx catalogue loads for a member who writes prescriptions.
    await waitFor(async () => {
      await user.clear(input);
      await user.type(input, 'start flubolt at night{Enter}');
      expect(path(router)).toBe(`${FILE}/prescriptions/create`);
    });
    expect(router.state.location.search).toMatchObject({ medicines: ['Flubolt 400'] });
    const drawer = await screen.findByTestId('rx-drawer');
    expect(within(drawer).getByTestId('rx-drawer-badges')).toHaveTextContent(
      '1 medicine',
    );
  });

  it('posts a team note from the card', async () => {
    const { user } = openOverview();
    const notes = await card('notes');
    await user.type(
      within(notes).getByRole('textbox', { name: 'Team note' }),
      'Called about the peel{Enter}',
    );
    expect(await within(notes).findByText('Called about the peel')).toBeInTheDocument();
    expect(within(notes).getByRole('textbox', { name: 'Team note' })).toHaveValue('');
  });

  it('uses a package session from its journey', async () => {
    const { user } = openOverview();
    const packages = await card('packages');
    const [use] = await within(packages).findAllByRole('button', { name: 'Use session' });
    await user.click(use!);
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Session 2 of 7 used'),
    );
  });

  it('shows the amounts on its eye, and opens an invoice and Receive payment', async () => {
    const { user, router } = openOverview();
    const billing = await card('billing');
    const eye = within(billing).getByRole('button', { name: 'Show amounts' });
    expect(eye).toHaveAttribute('aria-pressed', 'false');
    await user.click(eye);
    expect(
      await within(billing).findByRole('button', { name: 'Hide amounts' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(within(billing).queryByText('₹ ••••')).not.toBeInTheDocument();

    const [invoice] = await within(billing).findAllByTestId('overview-card-billing-row');
    await user.click(invoice!);
    await waitFor(() =>
      expect(path(router)).toMatch(/^\/organization\/acme\/invoices\/[^/]+\/edit$/),
    );
    expect(router.state.location.search).toMatchObject({
      from: `patients/${DHARTI}/timeline`,
    });
  });

  it('collects what is owed', async () => {
    const { user, router } = openOverview();
    const billing = await card('billing');
    await user.click(within(billing).getByRole('button', { name: 'Collect payment' }));
    await waitFor(() => expect(path(router)).toBe('/organization/acme/payments/receive'));
    expect(router.state.location.search).toMatchObject({ patient: DHARTI });
  });

  it('reschedules the next visit, and books one when none is', async () => {
    const { user, router, unmount } = openOverview();
    const visits = await card('visits');
    await user.click(await within(visits).findByRole('button', { name: 'Reschedule' }));
    await waitFor(() =>
      expect(path(router)).toMatch(/^\/organization\/acme\/appointments\/[^/]+$/),
    );
    expect(router.state.location.search).toEqual({
      mode: 'reschedule',
      from: `patients/${DHARTI}/timeline`,
    });
    unmount();

    const kavya = patientRef('Kavya Joshi');
    const booking = renderPatientFile(patientFileUrl(kavya, '/timeline'));
    const empty = await card('visits');
    expect(await within(empty).findByText('No visits yet')).toBeInTheDocument();
    await user.click(within(empty).getByRole('button', { name: 'Book' }));
    await waitFor(() =>
      expect(booking.router.state.location.pathname).toBe(
        '/organization/acme/appointments/create',
      ),
    );
    expect(booking.router.state.location.search).toMatchObject({ who: kavya });
  });

  it('opens a photo’s album, a treatment’s drawer and a new record', async () => {
    const { user, router } = openOverview({ role: 'owner' });
    const photos = await card('photos');
    const [thumb] = await within(photos).findAllByTestId('overview-card-photos-thumb');
    await user.click(thumb!);
    await waitFor(() => expect(path(router)).toBe(`${FILE}/images`));
    expect(router.state.location.search).toMatchObject({ album: 'lhr' });

    await router.navigate({ to: `${FILE}/timeline` });
    const treatments = await card('treatments');
    const [treatment] = await within(treatments).findAllByTestId(
      'overview-card-treatments-row',
    );
    await user.click(treatment!);
    await waitFor(() =>
      expect(path(router)).toMatch(new RegExp(`^${FILE}/treatments/[^/]+/edit$`)),
    );
  });

  it('adds a prescription, a treatment and a report from their cards', async () => {
    const { user, router } = openOverview({ role: 'owner' });
    for (const [name, label, target] of [
      ['prescriptions', 'New prescription', 'prescriptions/create'],
      ['treatments', 'New treatment', 'treatments/create'],
      ['reports', 'Upload report', 'reports/create'],
    ] as const) {
      await user.click(within(await card(name)).getByRole('button', { name: label }));
      await waitFor(() => expect(path(router)).toBe(`${FILE}/${target}`));
      await router.navigate({ to: `${FILE}/timeline` });
    }
  });
});
