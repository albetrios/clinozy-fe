import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { recordVisitSession } from '@/shared/api/clinic/visits-api.ts';
import { notify } from '@/shared/notify/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import {
  renderVisitRoute,
  resetVisitRoute,
  visitPath,
} from '../../__tests__/integration/visit-test-router.tsx';
import { VisitPage } from '../../VisitPage.tsx';

vi.mock('@/shared/notify/index.ts', () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
  TOAST_DURATION_MS: { default: 5_200, error: 9_000 },
}));

const receipts = () =>
  clinicFixtures.payments.snapshot((row) => row.kind === 'receipt').length;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant('2026-10-03', '10:42')));
  resetClinicFixtures();
  vi.mocked(notify.success).mockClear();
});
afterEach(() => {
  resetVisitRoute();
  resetClinicFixtures();
  vi.useRealTimers();
});

describe('VisitCheckout (KICKOFF §6.13 Checkout)', () => {
  it('bills the visit first, then takes a part payment and leaves the balance due', async () => {
    const user = userEvent.setup();
    renderVisitRoute(visitPath(2866, 'checkout'), VisitPage, { role: 'front_desk' });
    expect(
      await screen.findByText(/^Create the bill first\. A bill says what is owed/),
    ).toBeInTheDocument();
    expect(screen.getAllByTestId('visit-bill-line').length).toBeGreaterThan(0);
    await user.click(screen.getByTestId('visit-create-bill'));

    expect(await screen.findByTestId('visit-bill-made')).toHaveTextContent(
      /^✓ #\d+ finalised\. Changes now go through Cancel bill or Credit note\.$/,
    );
    const amount = await screen.findByTestId('visit-amount');
    const owed = Number((amount as HTMLInputElement).value);
    expect(owed).toBeGreaterThan(0);
    expect(screen.getByTestId('visit-mode-upi')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('visit-mode-split')).toHaveAttribute(
      'aria-disabled',
      'true',
    );

    await user.clear(amount);
    await user.type(amount, '100');
    expect(
      screen.getByText(
        'Partial payment. The balance becomes a due with a reminder task.',
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByTestId('visit-mode-cash'));
    expect(screen.getByTestId('visit-receive')).toHaveTextContent('Receive ₹100 by Cash');
    const before = receipts();
    await user.click(screen.getByTestId('visit-receive'));
    expect(await screen.findByTestId('elsewhere')).toHaveTextContent(
      '/organization/acme/today',
    );
    expect(receipts()).toBe(before + 1);
    expect(notify.success).toHaveBeenCalledWith(
      expect.stringMatching(
        /^₹100 received by Cash · PAY-\d+ · receipt sent on WhatsApp$/,
      ),
    );
  });

  it('records one payment however often Receive is pressed', async () => {
    const user = userEvent.setup();
    renderVisitRoute(visitPath(2864, 'checkout'), VisitPage, { role: 'front_desk' });
    const receive = await screen.findByTestId('visit-receive');
    expect(receive).toHaveTextContent('Receive ₹3,717 by UPI');
    const before = receipts();
    await user.dblClick(receive);
    expect(await screen.findByTestId('elsewhere')).toBeInTheDocument();
    expect(receipts()).toBe(before + 1);
    expect((await clinicFixtures.appointments.get(ref.appointment(2864))).status).toBe(
      'completed',
    );
  });

  it('opens the invoice’s preview from "Cancel bill", back to Today', async () => {
    const user = userEvent.setup();
    renderVisitRoute(visitPath(2864, 'checkout'), VisitPage, { role: 'front_desk' });
    await user.click(await screen.findByRole('button', { name: 'Cancel bill' }));
    expect(await screen.findByTestId('elsewhere')).toHaveTextContent(
      `/organization/acme/invoices/${ref.invoice(791)}?from=today`,
    );
  });

  it('completes a visit with nothing to pay', async () => {
    const user = userEvent.setup();
    await recordVisitSession({ visitId: ref.visit(2865), params: {}, bodyParts: [] });
    renderVisitRoute(visitPath(2865, 'checkout'), VisitPage, { role: 'front_desk' });
    expect(await screen.findByText(/From pack · no charge/)).toBeInTheDocument();
    await user.click(screen.getByTestId('visit-create-bill'));
    expect(await screen.findByText('Nothing to pay on this visit')).toBeInTheDocument();
    await user.click(screen.getByTestId('visit-complete'));
    expect(await screen.findByTestId('elsewhere')).toBeInTheDocument();
    expect(notify.success).toHaveBeenCalledWith('Visit completed for Dhruv Patel');
    await waitFor(async () =>
      expect((await clinicFixtures.appointments.get(ref.appointment(2865))).status).toBe(
        'completed',
      ),
    );
  });

  it('has no axe violations', async () => {
    const { baseElement } = renderVisitRoute(visitPath(2864, 'checkout'), VisitPage, {
      role: 'front_desk',
    });
    await screen.findByTestId('visit-receive');
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });
});
