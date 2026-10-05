import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { LedgerRow } from '@/shared/api/clinic/payments-contracts.ts';
import { CrossRoomDialogContext } from '@/shared/hooks/useCrossRoomDialog/index.ts';

import {
  renderPaymentsRoutes,
  resetPaymentsRoutes,
} from '../../__tests__/integration/payments-test-router.tsx';
import { PaymentsDialogHost, PaymentsDrawers } from './PaymentsDrawers.tsx';

// Each drawer stands in as its name and the props it was given: this unit picks one.
const { stub } = vi.hoisted(() => ({
  stub:
    (name: string) =>
    ({ onClose, ...props }: { onClose: () => void } & Record<string, unknown>) => (
      <section aria-label={name}>
        <output data-testid={name}>{JSON.stringify(props)}</output>
        <button type="button" onClick={onClose}>
          Close {name}
        </button>
      </section>
    ),
}));
vi.mock('../ReceivePaymentDrawer/index.ts', () => ({
  ReceivePaymentDrawer: stub('receive'),
}));
vi.mock('../SendPaymentDrawer/index.ts', () => ({ SendPaymentDrawer: stub('send') }));
vi.mock('../DayCloseDrawer/index.ts', () => ({ DayCloseDrawer: stub('day-close') }));

const RHEA = patientRef('Rhea Shah');
const props = (name: string) =>
  JSON.parse(screen.getByTestId(name).textContent ?? '{}') as unknown;
const entry = (direction: 'received' | 'paid') =>
  ({ id: 'e1', seq: 5512, direction }) as unknown as LedgerRow;

beforeEach(() => resetClinicFixtures());
afterEach(() => {
  resetPaymentsRoutes();
  resetClinicFixtures();
});

describe('PaymentsDrawers', () => {
  it('opens the drawer the dialog names', async () => {
    const onClose = vi.fn();
    const { container, rerender } = render(
      <PaymentsDrawers
        dialog={{ kind: 'receive', prefill: { patient: RHEA } }}
        onClose={onClose}
      />,
    );
    expect(props('receive')).toEqual({
      open: true,
      mode: 'create',
      prefill: { patient: RHEA },
    });
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole('button', { name: 'Close receive' }));
    expect(onClose).toHaveBeenCalledOnce();

    rerender(
      <PaymentsDrawers
        dialog={{ kind: 'pay', prefill: { bill: 'md:x' } }}
        onClose={onClose}
      />,
    );
    expect(props('send')).toEqual({ open: true, mode: 'create', bill: 'md:x' });

    for (const [direction, name] of [
      ['received', 'receive'],
      ['paid', 'send'],
    ] as const) {
      rerender(
        <PaymentsDrawers
          dialog={{
            kind: 'edit',
            paymentId: 'e1',
            payment: entry(direction),
            readOnly: true,
          }}
          onClose={onClose}
        />,
      );
      expect(props(name)).toMatchObject({ mode: 'edit', readOnly: true });
    }

    rerender(
      <PaymentsDrawers
        dialog={{ kind: 'edit', paymentId: 'e1', payment: undefined, readOnly: false }}
        onClose={onClose}
      />,
    );
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('opens Day close only over the ledger — where its day picker is given', () => {
    const dialog = { kind: 'dayClose', search: { date: '2026-10-03' } } as const;
    const { rerender } = render(<PaymentsDrawers dialog={dialog} onClose={vi.fn()} />);
    expect(screen.queryByTestId('day-close')).toBeNull();
    rerender(<PaymentsDrawers dialog={dialog} onClose={vi.fn()} onDayChange={vi.fn()} />);
    expect(props('day-close')).toMatchObject({ search: { date: '2026-10-03' } });
  });

  it('PaymentsDialogHost opens Receive over another room, from the drawer’s own route (A-P1)', async () => {
    const close = vi.fn();
    renderPaymentsRoutes('/organization/acme/payments/pending', {
      pending: () => (
        <CrossRoomDialogContext.Provider
          value={{
            pathname: '/organization/acme/payments/receive',
            search: { patient: RHEA, from: 'payments/pending' },
            params: { organizationSlug: 'acme' },
            close,
          }}
        >
          <PaymentsDialogHost />
        </CrossRoomDialogContext.Provider>
      ),
    });
    await waitFor(() =>
      expect(props('receive')).toEqual({
        open: true,
        mode: 'create',
        prefill: { patient: RHEA, from: 'payments/pending' },
      }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Close receive' }));
    expect(close).toHaveBeenCalledOnce();
  });
});
