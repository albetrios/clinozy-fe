import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchCredit } from '@/shared/api/clinic/credits-api.ts';
import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { CreditDrawer } from './CreditDrawer.tsx';

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

/** 10:00 on 3 Oct, clinic time — the seed day (27 Sep) is today. */
const NOW = new Date('2026-10-03T04:30:00Z');
const D = 'credit-drawer';
const TANVI = patientRef('Tanvi Shah');

const part = (id: string) => screen.getByTestId(`${D}-${id}`);
const credits = () => clinicFixtures.pendingCredits.snapshot();

function setUser() {
  return userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
}

/** Picks a patient in Who through its search. */
async function pickTanvi(user: ReturnType<typeof setUser>) {
  await user.click(await screen.findByTestId(`${D}-who`));
  await user.type(await screen.findByTestId(`${D}-who-search`), 'Tanvi');
  await user.click(await screen.findByTestId(`${D}-who-option-patient:${TANVI}`));
  await waitFor(() => expect(part('who')).toHaveTextContent('Tanvi Shah'));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  viewport.tier = 'desktop';
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  vi.useRealTimers();
  resetClinicFixtures();
});

describe('CreditDrawer — Add pending (payments.md:152–168)', () => {
  it('opens on "Which way", Give picked, stacked with "Back"', async () => {
    const { baseElement } = renderWithProviders(
      <CreditDrawer open mode="create" onClose={vi.fn()} />,
    );
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByText('Add pending')).toBeInTheDocument();
    expect(
      within(drawer).getByText(
        'Money the clinic has to give back or take · settle it later from Pending',
      ),
    ).toBeInTheDocument();
    expect(part('way-give')).toHaveAttribute('aria-pressed', 'true');
    expect(part('way-give')).toHaveAttribute('title', 'We pay them back');
    expect(part('who')).toHaveTextContent('Search patients, contacts or suppliers');
    expect(part('dismiss')).toHaveTextContent('Back');
    expect(part('save')).toHaveTextContent('Save · give later');
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });

  it('checks who, the amount and a reason in turn, then saves "CR-3 saved · give ₹500 to Tanvi Shah"', async () => {
    const user = setUser();
    const onClose = vi.fn();
    renderWithProviders(<CreditDrawer open mode="create" onClose={onClose} />);
    await user.click(await screen.findByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Pick who');

    await pickTanvi(user);
    await user.click(part('save'));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Enter the amount');

    await user.type(part('amount'), '500');
    await user.click(part('save'));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Pick a reason');
    // The Why step opened on the missing reason.
    await user.click(await screen.findByTestId(`${D}-reason-charged_twice`));
    expect(part('summary')).toHaveTextContent(
      'Give ₹500 back to Tanvi Shah · Charged twice',
    );
    await user.click(part('save'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(notifyMock.success).toHaveBeenCalledWith(
      'CR-3 saved · give ₹500 to Tanvi Shah',
    );
    const saved = credits().find((credit) => credit.seq === 3);
    expect(saved).toMatchObject({
      direction: 'give',
      partyName: 'Tanvi Shah',
      patientId: TANVI,
      amount: 50_000,
      reasonKey: 'charged_twice',
      reason: 'Charged twice',
      status: 'open',
    });
  });

  it('links a patient’s invoice through For invoice', async () => {
    const user = setUser();
    renderWithProviders(<CreditDrawer open mode="create" onClose={vi.fn()} />);
    await pickTanvi(user);
    await user.type(part('amount'), '200');
    await user.click(part('step-why-trigger'));
    await user.click(await screen.findByTestId(`${D}-reason-overpaid`));
    const invoice = await screen.findByTestId(`${D}-invoice`);
    expect(invoice).toHaveTextContent('No invoice');
    await user.click(invoice);
    const option = await screen.findByTestId(`${D}-invoice-option-${ref.invoice(772)}`);
    expect(option).toHaveTextContent('Invoice #772');
    expect(option).toHaveTextContent('₹1,000 · ₹600 due');
    await user.click(option);
    await user.click(part('save'));
    await waitFor(() => expect(notifyMock.success).toHaveBeenCalled());
    expect(credits().find((credit) => credit.seq === 3)?.invoiceId).toBe(
      ref.invoice(772),
    );
  });

  it('takes a typed name, wants a note for "Other", and saves a Take', async () => {
    const user = setUser();
    renderWithProviders(
      <CreditDrawer open mode="create" direction="take" onClose={vi.fn()} />,
    );
    expect(await screen.findByTestId(`${D}-save`)).toHaveTextContent('Save · take later');
    await user.click(part('who'));
    await user.type(await screen.findByTestId(`${D}-who-search`), 'Shree Ram Agencies');
    const create = await screen.findByTestId(`${D}-who-create`);
    expect(create).toHaveTextContent('Add “Shree Ram Agencies”');
    await user.click(create);
    await waitFor(() => expect(part('who')).toHaveTextContent('Shree Ram Agencies'));
    await user.type(part('amount'), '800');
    await user.click(part('step-why-trigger'));
    await user.click(await screen.findByTestId(`${D}-reason-other`));
    expect(part('note')).toHaveAttribute(
      'placeholder',
      'e.g. Supplier will adjust in the next bill',
    );
    expect(screen.queryByTestId(`${D}-invoice`)).toBeNull();
    await user.click(part('save'));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Add a note for “Other”');
    await user.type(part('note'), 'Short on the last delivery');
    await user.click(part('save'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith(
        'CR-3 saved · take ₹800 from Shree Ram Agencies',
      ),
    );
    expect(credits().find((credit) => credit.seq === 3)).toMatchObject({
      partyName: 'Shree Ram Agencies',
      patientId: null,
      reasonKey: 'other',
      reason: 'Short on the last delivery',
    });
  });

  it('drops the picked reason when the way changes', async () => {
    const user = setUser();
    renderWithProviders(<CreditDrawer open mode="create" onClose={vi.fn()} />);
    await user.click(await screen.findByTestId(`${D}-step-why-trigger`));
    await user.click(await screen.findByTestId(`${D}-reason-overpaid`));
    expect(part('reason-overpaid')).toHaveAttribute('aria-pressed', 'true');
    await user.click(part('step-way-trigger'));
    await user.click(await screen.findByTestId(`${D}-way-take`));
    expect(part('save')).toHaveTextContent('Save · take later');
    await user.click(part('step-why-trigger'));
    expect(await screen.findByTestId(`${D}-reason-short_payment`)).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.queryByTestId(`${D}-reason-overpaid`)).toBeNull();
  });
});

describe('CreditDrawer — Edit pending (S:90)', () => {
  beforeEach(() => {
    useOrganizationStore.getState().setPermissions(['organization:read']);
    useUIStore.setState({ previewRole: 'admin' });
  });
  afterEach(() => {
    useUIStore.setState({ previewRole: null });
    useOrganizationStore.getState().clearPermissions();
  });

  it('opens an open credit — its free-text reason as "Other" — and saves "CR-1 updated"', async () => {
    const user = setUser();
    const onClose = vi.fn();
    const credit = await fetchCredit(ref.pendingCredit(1));
    renderWithProviders(
      <CreditDrawer open mode="edit" credit={credit} onClose={onClose} />,
    );
    expect(await screen.findByText('Edit pending')).toBeInTheDocument();
    expect(part('tag')).toHaveTextContent('CR-1');
    expect(
      screen.getByText('Editable while it is open · changes are logged'),
    ).toBeInTheDocument();
    expect(part('who')).toHaveTextContent('Medline Surgicals');
    expect(part('summary')).toHaveTextContent(
      'Take ₹800 from Medline Surgicals · Returned a box of damaged gloves',
    );
    expect(part('save')).toHaveTextContent('Save changes');
    expect(part('delete')).toBeInTheDocument();
    const amount = part('amount');
    await user.clear(amount);
    await user.type(amount, '600');
    await user.click(part('save'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(notifyMock.success).toHaveBeenCalledWith('CR-1 updated');
    expect(await fetchCredit(ref.pendingCredit(1))).toMatchObject({
      amount: 60_000,
      reasonKey: 'other',
      reason: 'Returned a box of damaged gloves',
    });
  });

  it('only shows a credit to someone without Edit', async () => {
    const credit = await fetchCredit(ref.pendingCredit(2));
    renderWithProviders(
      <CreditDrawer open mode="edit" credit={credit} readOnly onClose={vi.fn()} />,
    );
    expect(await screen.findByText('Edit pending')).toBeInTheDocument();
    expect(screen.queryByTestId(`${D}-save`)).toBeNull();
    expect(screen.queryByTestId(`${D}-delete`)).toBeNull();
  });
});
