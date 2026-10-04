import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { OfferingRecord } from '@/shared/api/clinic/offerings-contracts.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { useStackedDrawer } from '@/shared/hooks/useStackedDrawer/index.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { OfferingQuickCreate } from './OfferingQuickCreate.tsx';

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

const Q = 'offering-quick-create';

function setUser() {
  return userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
}

const part = (id: string) => screen.getByTestId(`${Q}-${id}`);

/**
 * An invoice drawer whose line picker stacks "New offering" on top (L-40's
 * wiring): the child opens with the picker's text, and its offering lands on
 * the line.
 */
function InvoiceDrawer({ onLine }: { onLine: (offering: OfferingRecord) => void }) {
  const [open, setOpen] = useState(true);
  const child = useStackedDrawer<OfferingRecord>(onLine);
  return (
    <>
      <RecordDrawer
        open={open}
        title="New invoice"
        testId="invoice"
        onClose={() => setOpen(false)}
      >
        <button type="button" onClick={() => child.open('Hydra facial')}>
          New offering · “Hydra facial”
        </button>
      </RecordDrawer>
      <OfferingQuickCreate
        open={child.isOpen}
        query={child.query}
        onClose={child.close}
        onCreated={child.complete}
      />
    </>
  );
}

async function openChild(user: ReturnType<typeof setUser>) {
  const onLine = vi.fn();
  renderWithProviders(<InvoiceDrawer onLine={onLine} />);
  await user.click(
    await screen.findByRole('button', { name: 'New offering · “Hydra facial”' }),
  );
  const panel = await screen.findByTestId(Q);
  return { onLine, panel };
}

beforeEach(() => {
  viewport.tier = 'desktop';
  useLocaleStore.setState({ formatLocale: 'en-IN' });
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  useLocaleStore.setState({ formatLocale: 'en-US' });
  resetClinicFixtures();
});

describe('OfferingQuickCreate (KICKOFF §6.11, L-30e)', () => {
  it('stacks on the invoice with the picker’s text, three steps and "Back" · "Add offering"', async () => {
    const user = setUser();
    const { panel } = await openChild(user);
    expect(part('title')).toHaveTextContent('New offering');
    expect(
      within(panel).getByText('Service, treatment or package you bill'),
    ).toBeVisible();
    expect(screen.queryByTestId(`${Q}-badges`)).not.toBeInTheDocument();
    expect(screen.queryByTestId(`${Q}-quick-fill`)).not.toBeInTheDocument();
    expect(part('name')).toHaveValue('Hydra facial');
    expect(part('name')).toHaveAttribute('placeholder', 'e.g. LHR Full Face');
    expect(within(part('step-offering')).getByText('Offering')).toBeVisible();
    expect(within(part('step-details')).getByText('Details')).toBeVisible();
    expect(within(part('step-payment')).getByText('Payment')).toBeVisible();
    expect(part('step-payment')).toHaveTextContent('Missing: Price');
    expect(part('dismiss')).toHaveTextContent('Back');
    expect(part('save')).toHaveTextContent('Add offering');
    expect(await axeForDialog(panel)).toHaveNoViolations();
  });

  it('works its steps: "Next: Details →" and a head open the next one', async () => {
    const user = setUser();
    await openChild(user);
    await user.click(part('step-offering-next'));
    expect(part('step-details')).toHaveAttribute('data-status', 'open');
    expect(part('duration')).toHaveValue('30');
    expect(part('category-treatment')).toHaveAttribute('aria-pressed', 'true');
    await user.click(part('step-payment-trigger'));
    expect(part('step-payment')).toHaveAttribute('data-status', 'open');
  });

  it('asks for the price, then adds a fresh offering and hands it to the line', async () => {
    const user = setUser();
    const { onLine } = await openChild(user);
    await user.click(part('save'));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Enter the price');
    expect(part('step-payment')).toHaveAttribute('data-status', 'open');
    await user.type(part('price'), '2500');
    await user.click(part('save'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Offering Hydra facial added'),
    );
    await waitFor(() => expect(screen.queryByTestId(Q)).not.toBeInTheDocument());
    expect(onLine).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Hydra facial', price: 250_000 }),
    );
    const [created] = clinicFixtures.offerings.snapshot(
      (offering) => offering.name === 'Hydra facial',
    );
    // A fresh record with the contract's defaults, never a clone of a row (H:4070).
    expect(created).toMatchObject({
      category: 'treatment',
      durationMin: 30,
      sessions: 1,
      validityDays: 0,
      offerPrice: null,
      minPrice: 0,
      active: true,
    });
    expect(screen.getByTestId('invoice')).toBeInTheDocument();
  });

  it('asks for a name when the picker gave none', async () => {
    const user = setUser();
    await openChild(user);
    await user.clear(part('name'));
    await user.click(part('save'));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Add a name');
    expect(part('step-offering')).toHaveAttribute('data-status', 'open');
  });

  it('closes only itself on Esc, the invoice staying open (§6.0)', async () => {
    const user = setUser();
    await openChild(user);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId(Q)).not.toBeInTheDocument());
    expect(screen.getByTestId('invoice')).toBeInTheDocument();
  });
});
